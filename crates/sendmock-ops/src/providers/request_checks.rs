use std::collections::BTreeMap;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;

use super::message_provider_definition::MessageProviderDefinition;
use super::provider_http::ProviderHttpRequest;

/// Why a request is refused: the error kind, the part and a sentence for the log, plus the
/// provider's error code and message when SendMock knows them; otherwise the error template's
/// own defaults apply.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderFailure {
    pub kind: String,
    pub part: String,
    pub reason: String,
    pub code: Option<String>,
    pub provider_message: Option<String>,
}

impl ProviderFailure {
    pub fn new(kind: &str, part: &str, reason: String) -> Self {
        Self {
            kind: kind.to_owned(),
            part: part.to_owned(),
            reason,
            code: None,
            provider_message: None,
        }
    }
}

/// The first validation rule the request fails, in the provider's order.
pub fn find_rule_failure(
    provider: &MessageProviderDefinition,
    part_values: &BTreeMap<String, Vec<String>>,
) -> Option<ProviderFailure> {
    provider
        .validation_rules
        .iter()
        .find_map(|validation_rule| {
            let values = part_values
                .get(&validation_rule.part)
                .map_or(&[][..], Vec::as_slice);
            let is_failing = match validation_rule.check.as_str() {
                "required" => values.is_empty(),
                "email_address" => values.iter().any(|value| !is_email_address(value)),
                "e164_number" => values.iter().any(|value| !is_e164_number(value)),
                "max_length" => values.iter().any(|value| {
                    value.chars().count() > validation_rule.max_length.unwrap_or(usize::MAX)
                }),
                _ => false,
            };
            is_failing.then(|| {
                let mut failure = ProviderFailure::new(
                    &validation_rule.error_kind,
                    &validation_rule.part,
                    format!(
                        "{} failed the {} check",
                        validation_rule.part, validation_rule.check
                    ),
                );
                if validation_rule.check == "required" {
                    failure.code = provider
                        .outcome_error_codes
                        .get(&format!("missing_{}", validation_rule.part))
                        .cloned();
                }
                failure
            })
        })
}

fn is_email_address(value: &str) -> bool {
    let Some((local_part, domain)) = value.split_once('@') else {
        return false;
    };
    let has_no_separators = |text: &str| {
        !text.contains(|character: char| character.is_whitespace() || "@<>".contains(character))
    };
    !local_part.is_empty()
        && has_no_separators(local_part)
        && has_no_separators(domain)
        && domain
            .split_once('.')
            .is_some_and(|(name, suffix)| !name.is_empty() && !suffix.is_empty())
}

/// `+` and 7 to 15 digits, ignoring a `whatsapp:` prefix.
fn is_e164_number(value: &str) -> bool {
    let number = value.strip_prefix("whatsapp:").unwrap_or(value);
    number.strip_prefix('+').is_some_and(|digits| {
        (7..=15).contains(&digits.len())
            && digits.chars().all(|character| character.is_ascii_digit())
            && !digits.starts_with('0')
    })
}

/// When the provider checks credentials, one of its secrets must appear in the request:
/// in a header (Basic auth decoded), the query string or the body.
pub fn has_valid_credentials(
    provider: &MessageProviderDefinition,
    request: &ProviderHttpRequest,
) -> bool {
    let secret_values: Vec<&str> = provider
        .credentials
        .iter()
        .filter(|credential| credential.is_secret && !credential.value.is_empty())
        .map(|credential| credential.value.as_str())
        .collect();
    if !provider.check_credentials || secret_values.is_empty() {
        return true;
    }
    let decoded_basic_auth = request
        .header("authorization")
        .and_then(|authorization| authorization.strip_prefix("Basic "))
        .and_then(|encoded| STANDARD.decode(encoded.trim()).ok())
        .map(|decoded| String::from_utf8_lossy(&decoded).into_owned())
        .unwrap_or_default();
    let request_text = format!(
        "{} {} {} {}",
        request
            .headers
            .values()
            .cloned()
            .collect::<Vec<_>>()
            .join(" "),
        decoded_basic_auth,
        request.query_string.as_deref().unwrap_or_default(),
        String::from_utf8_lossy(&request.body)
    );
    secret_values
        .iter()
        .any(|secret_value| request_text.contains(secret_value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::message_provider_definition::{
        ProviderCredential, ProviderValidationRule,
    };

    fn provider_with_rules(
        validation_rules: Vec<ProviderValidationRule>,
    ) -> MessageProviderDefinition {
        MessageProviderDefinition {
            validation_rules,
            outcome_error_codes: BTreeMap::from([("missing_to".to_owned(), "21604".to_owned())]),
            ..MessageProviderDefinition::default()
        }
    }

    fn rule(part: &str, check: &str, error_kind: &str) -> ProviderValidationRule {
        ProviderValidationRule {
            part: part.to_owned(),
            check: check.to_owned(),
            max_length: Some(5),
            error_kind: error_kind.to_owned(),
        }
    }

    #[test]
    fn the_first_failing_rule_names_its_kind_part_and_code() {
        let provider = provider_with_rules(vec![
            rule("to", "required", "missing_field"),
            rule("to", "e164_number", "invalid_value"),
        ]);

        let missing = find_rule_failure(&provider, &BTreeMap::new());
        let invalid = find_rule_failure(
            &provider,
            &BTreeMap::from([("to".to_owned(), vec!["555".to_owned()])]),
        );
        let valid = find_rule_failure(
            &provider,
            &BTreeMap::from([("to".to_owned(), vec!["whatsapp:+15550001111".to_owned()])]),
        );

        assert_eq!(
            missing.map(|failure| (failure.kind, failure.code)),
            Some(("missing_field".to_owned(), Some("21604".to_owned())))
        );
        assert_eq!(
            invalid.map(|failure| failure.kind),
            Some("invalid_value".to_owned())
        );
        assert_eq!(valid, None);
    }

    #[test]
    fn email_and_length_checks_follow_the_form() {
        let provider = provider_with_rules(vec![
            rule("from", "email_address", "invalid_value"),
            rule("body", "max_length", "invalid_value"),
        ]);

        let bad_address = find_rule_failure(
            &provider,
            &BTreeMap::from([("from".to_owned(), vec!["a@b".to_owned()])]),
        );
        let long_body = find_rule_failure(
            &provider,
            &BTreeMap::from([("body".to_owned(), vec!["toolong".to_owned()])]),
        );

        assert_eq!(
            bad_address.map(|failure| failure.part),
            Some("from".to_owned())
        );
        assert_eq!(
            long_body.map(|failure| failure.part),
            Some("body".to_owned())
        );
        assert!(is_email_address("dev@app.test"));
    }

    // AC: SM-02.3
    #[test]
    fn checked_credentials_accept_the_secret_in_basic_auth() {
        let provider = MessageProviderDefinition {
            check_credentials: true,
            credentials: vec![ProviderCredential {
                name: "auth_token".to_owned(),
                value: "s3cret".to_owned(),
                is_secret: true,
            }],
            ..MessageProviderDefinition::default()
        };
        let mut request = ProviderHttpRequest::default();

        let without_secret = has_valid_credentials(&provider, &request);
        request.headers.insert(
            "authorization".to_owned(),
            format!("Basic {}", STANDARD.encode("AC123:s3cret")),
        );

        assert!(!without_secret);
        assert!(has_valid_credentials(&provider, &request));
    }
}
