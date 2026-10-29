use schemars::JsonSchema;
use serde::Serialize;
use serde_json::Value;

/// Longer examples are cut, so the reference panel stays readable.
const EXAMPLE_LENGTH_LIMIT: usize = 60;

/// Everything a template can read, plus the functions and filters it can call.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct TemplateReference {
    pub fields: Vec<TemplateReferenceField>,
    pub functions: Vec<TemplateReferenceHelper>,
    pub filters: Vec<TemplateReferenceHelper>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct TemplateReferenceField {
    /// Where the value is, e.g. `request.path_params`.
    pub path: String,
    pub name: String,
    /// `string`, `number`, `boolean`, `timestamp`, `object` or `list`.
    pub value_type: String,
    pub description: String,
    /// The value in the sample, or null for objects and lists.
    #[schemars(required)]
    pub example: Option<String>,
    pub children: Vec<TemplateReferenceField>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct TemplateReferenceHelper {
    pub name: String,
    pub signature: String,
    pub description: String,
    pub example: String,
}

/// What each value a provider template can read means, by path.
const PROVIDER_FIELD_DESCRIPTIONS: &[(&str, &str)] = &[
    (
        "request",
        "The request your app sent to the provider's path.",
    ),
    ("request.method", "The HTTP method, e.g. POST."),
    ("request.path", "The path as your app called it."),
    (
        "request.path_params",
        "The values of the path's {name} parts, e.g. domain or AccountSid.",
    ),
    ("request.headers", "The request headers, by lowercase name."),
    (
        "request.body",
        "The parsed body: JSON, or the fields of a form or query.",
    ),
    ("message", "The message SendMock stores for the request."),
    ("message.id", "SendMock's own id (a ULID)."),
    (
        "message.provider_id",
        "The provider's id, from the Message id template.",
    ),
    (
        "message.from",
        "The sender, read through the field mapping.",
    ),
    ("message.to", "The recipients, comma-separated."),
    ("message.subject", "The email subject; empty for SMS."),
    (
        "message.body",
        "The text body (email text or the SMS body).",
    ),
    ("message.status", "SendMock's status, e.g. queued."),
    ("error", "Why the request was refused, in error responses."),
    (
        "error.kind",
        "missing_field, invalid_value, unauthorized, not_found or rate_limited.",
    ),
    ("error.part", "The message part that failed, e.g. to."),
    ("error.reason", "A sentence that explains the failure."),
    (
        "credentials",
        "The provider's credentials by name; secrets are masked in previews.",
    ),
];

/// The functions the template engine knows, as `sendmock-core` implements them.
const TEMPLATE_FUNCTIONS: &[(&str, &str, &str, &str)] = &[
    (
        "uuid",
        "uuid()",
        "A random UUID, e.g. for a transmission id.",
        "3b241101-e2bb-4255-8caf-4136c566a962",
    ),
    (
        "random_hex",
        "random_hex(length)",
        "Random lowercase hex digits, e.g. for a signature.",
        "9f86d081884c7d65",
    ),
    (
        "random_string",
        "random_string(length)",
        "Random letters and digits, e.g. for a nonce or token.",
        "q8F2kD9xLm",
    ),
    (
        "now_iso",
        "now_iso()",
        "The current time as an ISO 8601 timestamp.",
        "2026-10-25T09:15:27.000Z",
    ),
    (
        "now_unix",
        "now_unix()",
        "The current time as Unix seconds.",
        "1792914927",
    ),
];

const TEMPLATE_FILTERS: &[(&str, &str, &str, &str)] = &[
    (
        "default",
        "default(fallback)",
        "The fallback when the value is missing or empty; no warning is given.",
        "{{ message.body | default(\"No body\") }}",
    ),
    (
        "json",
        "json",
        "The value as JSON text, for objects and lists.",
        "{{ request.body | json }}",
    ),
    (
        "urlencode",
        "urlencode",
        "Percent-encodes the value for form bodies and query strings.",
        "{{ message.body | urlencode }}",
    ),
    ("lower", "lower", "Lowercase.", "{{ message.from | lower }}"),
    (
        "upper",
        "upper",
        "Uppercase.",
        "{{ message.status | upper }}",
    ),
];

/// The reference for a provider template context: its fields from the sample values, with
/// their meaning, and the engine's functions and filters.
pub fn build_provider_template_reference(template_context: &Value) -> TemplateReference {
    let fields = template_context
        .as_object()
        .map(|context_fields| {
            context_fields
                .iter()
                .map(|(field_name, sample_value)| build_field(field_name, field_name, sample_value))
                .collect()
        })
        .unwrap_or_default();
    TemplateReference {
        fields,
        functions: build_helpers(TEMPLATE_FUNCTIONS),
        filters: build_helpers(TEMPLATE_FILTERS),
    }
}

fn build_helpers(catalog: &[(&str, &str, &str, &str)]) -> Vec<TemplateReferenceHelper> {
    catalog
        .iter()
        .map(
            |(name, signature, description, example)| TemplateReferenceHelper {
                name: (*name).to_owned(),
                signature: (*signature).to_owned(),
                description: (*description).to_owned(),
                example: (*example).to_owned(),
            },
        )
        .collect()
}

/// A field and its children; a list shows its first item as `[0]`.
fn build_field(field_path: &str, field_name: &str, sample_value: &Value) -> TemplateReferenceField {
    let children = match sample_value {
        Value::Object(child_values) => child_values
            .iter()
            .map(|(child_name, child_value)| {
                build_field(
                    &format!("{field_path}.{child_name}"),
                    child_name,
                    child_value,
                )
            })
            .collect(),
        Value::Array(items) => items
            .first()
            .map(|first_item| vec![build_field(&format!("{field_path}[0]"), "[0]", first_item)])
            .unwrap_or_default(),
        _ => Vec::new(),
    };
    TemplateReferenceField {
        path: field_path.to_owned(),
        name: field_name.to_owned(),
        value_type: describe_value_type(sample_value).to_owned(),
        description: PROVIDER_FIELD_DESCRIPTIONS
            .iter()
            .find(|(described_path, _)| *described_path == field_path)
            .map(|(_, description)| (*description).to_owned())
            .unwrap_or_default(),
        example: describe_example(sample_value),
        children,
    }
}

fn describe_value_type(sample_value: &Value) -> &'static str {
    match sample_value {
        Value::Array(_) => "list",
        Value::Object(_) => "object",
        Value::Number(_) => "number",
        Value::Bool(_) => "boolean",
        Value::String(text) if is_timestamp(text) => "timestamp",
        Value::String(_) | Value::Null => "string",
    }
}

/// `2026-10-25T...`: four digits, a dash, two digits, a dash, two digits and a `T`.
fn is_timestamp(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() > 10
        && bytes[..4].iter().all(u8::is_ascii_digit)
        && bytes[4] == b'-'
        && bytes[5..7].iter().all(u8::is_ascii_digit)
        && bytes[7] == b'-'
        && bytes[8..10].iter().all(u8::is_ascii_digit)
        && bytes[10] == b'T'
}

fn describe_example(sample_value: &Value) -> Option<String> {
    let example_text = match sample_value {
        Value::Null | Value::Object(_) | Value::Array(_) => return None,
        Value::String(text) => text.clone(),
        other_value => other_value.to_string(),
    };
    if example_text.chars().count() > EXAMPLE_LENGTH_LIMIT {
        let shortened: String = example_text.chars().take(EXAMPLE_LENGTH_LIMIT).collect();
        return Some(format!("{shortened}..."));
    }
    Some(example_text)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    // AC: SM-16.4
    #[test]
    fn the_reference_describes_each_context_field_with_its_type_and_example() {
        let template_context = json!({
            "request": { "path_params": { "AccountSid": "AC123" } },
            "message": { "created_at": "2026-10-25T09:15:27Z", "to": ["+15551234567"] },
        });

        let reference = build_provider_template_reference(&template_context);

        let find_field = |fields: &[TemplateReferenceField], field_path: &str| {
            fields
                .iter()
                .find(|field| field.path == field_path)
                .cloned()
                .unwrap_or_else(|| panic!("{field_path} is listed"))
        };
        let request = find_field(&reference.fields, "request");
        let path_params = find_field(&request.children, "request.path_params");
        assert!(path_params.description.contains("{name} parts"));
        assert_eq!(path_params.children[0].example.as_deref(), Some("AC123"));
        let message = find_field(&reference.fields, "message");
        let created_at = find_field(&message.children, "message.created_at");
        let recipients = find_field(&message.children, "message.to");
        assert_eq!(created_at.value_type, "timestamp");
        assert_eq!(recipients.value_type, "list");
        assert_eq!(recipients.children[0].path, "message.to[0]");
        assert!(
            reference
                .functions
                .iter()
                .any(|function| function.name == "uuid")
        );
        assert!(
            reference
                .filters
                .iter()
                .any(|filter| filter.name == "urlencode")
        );
    }
}
