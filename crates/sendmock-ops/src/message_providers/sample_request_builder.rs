use std::collections::BTreeMap;

use serde_json::{Map, Value};

use super::provider_inputs::ProviderSampleRequest;
use crate::providers::MessageProviderDefinition;

/// The value a sample send fills in for a message part, by area.
fn sample_value(area: &str, part: &str) -> Option<&'static str> {
    match (area, part) {
        ("sms", "from") => Some("+15005550006"),
        ("sms", "to") => Some("+15551234567"),
        ("sms", "body") => Some("Your Acme code is 482913"),
        ("email", "from") => Some("app@example.test"),
        ("email", "to") => Some("ana@example.test"),
        ("email", "subject") => Some("Welcome to Acme"),
        ("email", "text") => Some("Hi Ana, thanks for signing up."),
        ("email", "html") => Some("<p>Hi Ana, thanks for signing up.</p>"),
        ("email", "tags") => Some("signup"),
        _ => None,
    }
}

/// A send for the preview, from the provider's first operation and its field mapping, as the
/// Providers screen builds it.
pub fn build_sample_request(provider: &MessageProviderDefinition) -> ProviderSampleRequest {
    let Some(first_operation) = provider.operations.first() else {
        return ProviderSampleRequest {
            method: "POST".to_owned(),
            path: "/".to_owned(),
            headers: BTreeMap::new(),
            body: String::new(),
        };
    };
    let mapped_samples: Vec<(&str, &str)> = provider
        .field_mapping
        .iter()
        .filter(|field_mapping| !field_mapping.source.ends_with('*'))
        .filter_map(|field_mapping| {
            sample_value(&provider.area, &field_mapping.part)
                .map(|value| (field_mapping.source.as_str(), value))
        })
        .collect();
    let (content_type, body) = if first_operation.request_format == "json" {
        let mut json_body = Value::Object(Map::new());
        for (source_path, value) in &mapped_samples {
            write_at_path(&mut json_body, source_path, value);
        }
        (
            "application/json",
            serde_json::to_string_pretty(&json_body).unwrap_or_default(),
        )
    } else {
        (
            "application/x-www-form-urlencoded",
            serde_urlencoded::to_string(&mapped_samples).unwrap_or_default(),
        )
    };
    ProviderSampleRequest {
        method: first_operation.method.clone(),
        path: fill_path(&first_operation.path, provider),
        headers: BTreeMap::from([("content-type".to_owned(), content_type.to_owned())]),
        body,
    }
}

/// `{AccountSid}` filled from the credential of the same name (`account_sid`), else `example`;
/// underscores and case do not count.
fn fill_path(operation_path: &str, provider: &MessageProviderDefinition) -> String {
    let mut filled_path = String::with_capacity(operation_path.len());
    let mut remaining_path = operation_path;
    while let Some((before_part, after_brace)) = remaining_path.split_once('{') {
        let Some((part_name, after_part)) = after_brace.split_once('}') else {
            break;
        };
        filled_path.push_str(before_part);
        let credential_value = provider
            .credentials
            .iter()
            .find(|credential| {
                credential
                    .name
                    .replace('_', "")
                    .eq_ignore_ascii_case(&part_name.replace('_', ""))
            })
            .map_or("example", |credential| credential.value.as_str());
        filled_path.push_str(credential_value);
        remaining_path = after_part;
    }
    filled_path.push_str(remaining_path);
    filled_path
}

/// Writes the value at a source path such as `to[0].email` or `personalizations[*].subject`,
/// creating the objects and lists on the way.
fn write_at_path(target: &mut Value, source_path: &str, value: &str) {
    let path_steps: Vec<String> = source_path
        .replace('[', ".[")
        .split('.')
        .filter(|path_step| !path_step.is_empty())
        .map(str::to_owned)
        .collect();
    let mut current = target;
    for (step_index, path_step) in path_steps.iter().enumerate() {
        let next_is_list = path_steps
            .get(step_index + 1)
            .is_some_and(|next_step| next_step.starts_with('['));
        let is_last_step = step_index + 1 == path_steps.len();
        let empty_child = if next_is_list {
            Value::Array(Vec::new())
        } else {
            Value::Object(Map::new())
        };
        if path_step.starts_with('[') {
            let Value::Array(items) = current else {
                return;
            };
            if is_last_step {
                items.push(Value::from(value));
                return;
            }
            if items.is_empty() {
                items.push(empty_child);
            }
            let last_index = items.len() - 1;
            current = &mut items[last_index];
            continue;
        }
        let Value::Object(fields) = current else {
            return;
        };
        if is_last_step {
            fields.insert(path_step.clone(), Value::from(value));
            return;
        }
        current = fields.entry(path_step.clone()).or_insert(empty_child);
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::providers::builtin_sms_providers;

    fn find_builtin(provider_key: &str) -> MessageProviderDefinition {
        builtin_sms_providers()
            .into_iter()
            .find(|provider| provider.key == provider_key)
            .unwrap_or_else(|| panic!("{provider_key} is shipped"))
    }

    // AC: SM-16.4
    #[test]
    fn a_form_provider_gets_a_form_send_with_its_path_filled_from_the_credentials() {
        let sample_request = build_sample_request(&find_builtin("twilio"));

        assert_eq!(sample_request.method, "POST");
        assert!(sample_request.path.starts_with("/2010-04-01/Accounts/AC"));
        assert!(sample_request.path.ends_with("/Messages.json"));
        assert_eq!(
            sample_request
                .headers
                .get("content-type")
                .map(String::as_str),
            Some("application/x-www-form-urlencoded")
        );
        assert!(sample_request.body.contains("To=%2B15551234567"));
    }

    #[test]
    fn a_json_provider_gets_a_json_send_and_nested_sources_build_objects_and_lists() {
        let sample_request = build_sample_request(&find_builtin("plivo"));
        let mut nested_body = json!({});
        write_at_path(
            &mut nested_body,
            "personalizations[0].to[*].email",
            "ana@example.test",
        );
        write_at_path(&mut nested_body, "from.email", "app@example.test");

        let plivo_body: Value = serde_json::from_str(&sample_request.body)
            .unwrap_or_else(|error| panic!("a JSON body: {error}"));
        assert_eq!(plivo_body["dst"], "+15551234567");
        assert!(!sample_request.path.contains('{'));
        assert!(!sample_request.path.contains("example"));
        assert_eq!(
            nested_body,
            json!({
                "personalizations": [{ "to": [{ "email": "ana@example.test" }] }],
                "from": { "email": "app@example.test" },
            })
        );
    }
}
