use std::collections::HashSet;

use sendmock_core::{
    StandardTemplateFunctions, TemplateEscape, TemplateFunctions, TemplateProblemSeverity,
    render_template,
};
use serde_json::json;

use crate::providers::MessageProviderDefinition;
use crate::{OperationContext, OperationError};

/// Paths SendMock answers itself, never a provider's.
const RESERVED_PATH_PREFIXES: &[&str] = &["/api/", "/providers/"];

/// Refuses a save as the Providers screen does (docs/plan/22, Rules): the first field problem,
/// then the first template error.
pub fn check_provider_can_be_saved(
    operation_context: &OperationContext,
    provider: &MessageProviderDefinition,
    area_providers: &[MessageProviderDefinition],
) -> Result<(), OperationError> {
    if let Some((field_name, message)) = find_field_problem(provider, area_providers) {
        return Err(OperationError::InvalidInput {
            message,
            field: Some(field_name.to_owned()),
        });
    }
    let template_functions = StandardTemplateFunctions::new(
        operation_context.clock.clone(),
        operation_context.random_source.clone(),
    );
    match find_template_errors(&template_functions, provider)
        .into_iter()
        .next()
    {
        Some((part, message)) => Err(OperationError::InvalidInput {
            message: format!("{part}: {message}"),
            field: None,
        }),
        None => Ok(()),
    }
}

/// The first problem with a provider's fields, by field name.
fn find_field_problem(
    provider: &MessageProviderDefinition,
    area_providers: &[MessageProviderDefinition],
) -> Option<(&'static str, String)> {
    if provider.name.trim().is_empty() {
        return Some(("name", "Enter a name".to_owned()));
    }
    if !is_hex_colour(&provider.accent) {
        return Some(("accent", "Use a colour like #1e5bb8".to_owned()));
    }
    if let Some(problem) = find_credential_problem(provider) {
        return Some(("credentials", problem));
    }
    if let Some(problem) = find_operations_problem(provider, area_providers) {
        return Some(("operations", problem));
    }
    find_field_mapping_problem(provider).map(|problem| ("field_mapping", problem))
}

fn is_hex_colour(accent: &str) -> bool {
    accent.len() == 7
        && accent.starts_with('#')
        && accent[1..]
            .chars()
            .all(|character| character.is_ascii_hexdigit())
}

fn find_credential_problem(provider: &MessageProviderDefinition) -> Option<String> {
    let mut seen_names = HashSet::new();
    for credential in &provider.credentials {
        let is_valid_name = !credential.name.is_empty()
            && credential
                .name
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || "_.-".contains(character));
        if !is_valid_name {
            let shown_name = if credential.name.is_empty() {
                "A credential"
            } else {
                &credential.name
            };
            return Some(format!(
                "{shown_name} needs a name of letters, digits, _, . or -"
            ));
        }
        if !seen_names.insert(credential.name.as_str()) {
            return Some(format!("{} appears twice", credential.name));
        }
    }
    None
}

fn find_operations_problem(
    provider: &MessageProviderDefinition,
    area_providers: &[MessageProviderDefinition],
) -> Option<String> {
    if provider.operations.is_empty() {
        return Some("Answer at least one request".to_owned());
    }
    provider
        .operations
        .iter()
        .find_map(|operation| find_path_problem(&operation.path))
        .or_else(|| find_route_clash(provider, area_providers))
}

/// Why a path cannot be used, or `None`.
pub fn find_path_problem(path: &str) -> Option<String> {
    if !path.starts_with('/') {
        let shown_path = if path.is_empty() { "A path" } else { path };
        return Some(format!("{shown_path} must start with /"));
    }
    if RESERVED_PATH_PREFIXES
        .iter()
        .any(|reserved_prefix| path.starts_with(reserved_prefix))
    {
        return Some(format!(
            "{path} is SendMock's own path; providers cannot use /api/ or /providers/"
        ));
    }
    let open_brace_count = path.matches('{').count();
    let close_brace_count = path.matches('}').count();
    if open_brace_count != close_brace_count || path.contains("{}") {
        return Some(format!("{path} has an unfinished {{name}} part"));
    }
    None
}

/// `/v3/{domain}/messages` and `/v3/{name}/messages` are the same route.
fn normalize_route(method: &str, path: &str) -> String {
    let mut normalized_path = String::with_capacity(path.len());
    let mut is_inside_braces = false;
    for character in path.chars() {
        match character {
            '{' => {
                is_inside_braces = true;
                normalized_path.push_str("{}");
            }
            '}' => is_inside_braces = false,
            _ if is_inside_braces => {}
            _ => normalized_path.push(character),
        }
    }
    format!("{} {normalized_path}", method.to_ascii_uppercase())
}

/// Another enabled provider that answers one of the same routes, when the hosts do not tell
/// the two apart.
fn find_route_clash(
    provider: &MessageProviderDefinition,
    area_providers: &[MessageProviderDefinition],
) -> Option<String> {
    if !provider.is_enabled {
        return None;
    }
    let provider_routes: HashSet<String> = provider
        .operations
        .iter()
        .map(|operation| normalize_route(&operation.method, &operation.path))
        .collect();
    area_providers
        .iter()
        .find(|other_provider| {
            let hosts_differ = matches!(
                (&other_provider.host, &provider.host),
                (Some(other_host), Some(host)) if other_host != host
            );
            other_provider.key != provider.key
                && other_provider.is_routable()
                && !hosts_differ
                && other_provider.operations.iter().any(|operation| {
                    provider_routes.contains(&normalize_route(&operation.method, &operation.path))
                })
        })
        .map(|other_provider| {
            format!(
                "It answers the same path as {}; give each a different host or path",
                other_provider.name
            )
        })
}

fn find_field_mapping_problem(provider: &MessageProviderDefinition) -> Option<String> {
    let mut seen_parts = HashSet::new();
    let duplicate_part = provider
        .field_mapping
        .iter()
        .find(|field_mapping| !seen_parts.insert(field_mapping.part.as_str()));
    if provider
        .field_mapping
        .iter()
        .any(|field_mapping| field_mapping.source.trim().is_empty())
    {
        return Some("Every mapped part needs a source".to_owned());
    }
    duplicate_part.map(|field_mapping| format!("{} is mapped twice", field_mapping.part))
}

/// Template errors (unknown functions or filters, a `{{` without `}}`) in the message id and
/// every response, each with the part it is in.
pub fn find_template_errors(
    template_functions: &dyn TemplateFunctions,
    provider: &MessageProviderDefinition,
) -> Vec<(String, String)> {
    let empty_context = json!({ "request": {}, "message": {}, "error": {}, "credentials": {} });
    list_provider_templates(provider)
        .into_iter()
        .flat_map(|(part, template_text)| {
            render_template(
                template_text,
                &empty_context,
                template_functions,
                TemplateEscape::None,
            )
            .problems
            .into_iter()
            .filter(|problem| problem.severity == TemplateProblemSeverity::Error)
            .map(move |problem| (part.clone(), problem.message))
        })
        .collect()
}

/// The message id and each response's headers and body, named by part.
fn list_provider_templates(provider: &MessageProviderDefinition) -> Vec<(String, &str)> {
    let mut templates = vec![(
        "Message id".to_owned(),
        provider.message_id_template.as_str(),
    )];
    let responses = std::iter::once((
        "Success response".to_owned(),
        &provider.success_response.headers,
        provider.success_response.body.as_str(),
    ))
    .chain(provider.error_responses.iter().map(|error_response| {
        (
            format!("{} response", error_response.kind),
            &error_response.headers,
            error_response.body.as_str(),
        )
    }));
    for (part, headers, body) in responses {
        for header in headers {
            templates.push((
                format!("{part} header {}", header.name),
                header.template.as_str(),
            ));
        }
        templates.push((format!("{part} body"), body));
    }
    templates
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use sendmock_core::{FixedClock, SeededRandomSource};

    use super::*;
    use crate::providers::builtin_sms_providers;

    fn find_builtin(provider_key: &str) -> MessageProviderDefinition {
        builtin_sms_providers()
            .into_iter()
            .find(|provider| provider.key == provider_key)
            .unwrap_or_else(|| panic!("{provider_key} is shipped"))
    }

    // AC: SM-16.8
    #[test]
    fn every_shipped_provider_passes_the_save_rules() {
        let template_functions = StandardTemplateFunctions::new(
            Arc::new(FixedClock::new(0)),
            Arc::new(SeededRandomSource::new(7)),
        );
        let shipped_providers = builtin_sms_providers();

        for provider in &shipped_providers {
            assert_eq!(
                find_field_problem(provider, &shipped_providers),
                None,
                "{}",
                provider.key
            );
            assert!(
                find_template_errors(&template_functions, provider).is_empty(),
                "{}",
                provider.key
            );
        }
    }

    // AC: SM-16.4
    #[test]
    fn a_shared_path_clashes_unless_the_hosts_differ_or_one_provider_is_off() {
        let twilio = find_builtin("twilio");
        let mut copied_twilio = MessageProviderDefinition {
            key: "twilio_eu".to_owned(),
            ..twilio.clone()
        };
        let area_providers = vec![twilio];

        let clash = find_route_clash(&copied_twilio, &area_providers);
        copied_twilio.host = Some("api.eu.twilio.test".to_owned());
        let with_other_host = find_route_clash(&copied_twilio, &area_providers);
        copied_twilio.host = None;
        copied_twilio.is_enabled = false;
        let while_off = find_route_clash(&copied_twilio, &area_providers);

        assert!(clash.is_some_and(|message| message.contains("same path as Twilio")));
        assert_eq!((with_other_host, while_off), (None, None));
    }

    #[test]
    fn paths_must_start_with_a_slash_avoid_sendmocks_own_and_close_their_parts() {
        assert_eq!(find_path_problem("/v1/{AccountSid}/Messages"), None);
        assert!(find_path_problem("v1/messages").is_some());
        assert!(find_path_problem("/providers/twilio/send").is_some());
        assert!(find_path_problem("/v1/{AccountSid/Messages").is_some());
        assert!(find_path_problem("/v1/{}/Messages").is_some());
        assert_eq!(
            normalize_route("post", "/v3/{domain}/messages"),
            "POST /v3/{}/messages"
        );
    }
}
