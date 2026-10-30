use std::collections::BTreeSet;

use super::endpoint_inputs::WebhookEndpointInput;
use super::endpoint_settings::{BodyFieldType, EndpointBodyField, EndpointBodyMode};
use crate::OperationError;
use crate::numbers::is_http_url;

const TIMEOUT_LIMITS_MS: (u32, u32) = (1_000, 60_000);
const MAX_ATTEMPT_LIMITS: (u32, u32) = (1, 10);
const RETRY_DELAY_LIMITS_SECONDS: (u32, u32) = (1, 86_400);
/// The overlaps the Security tab offers: an hour, a day and a week.
pub const ALLOWED_OVERLAP_HOURS: [u32; 3] = [1, 24, 168];

fn field_error(field_name: &str, message: String) -> OperationError {
    OperationError::InvalidInput {
        message,
        field: Some(field_name.to_owned()),
    }
}

fn is_within(value: u32, (minimum, maximum): (u32, u32)) -> bool {
    (minimum..=maximum).contains(&value)
}

/// An absolute http(s) URL, or one whose templated parts start the URL or follow the scheme.
fn is_endpoint_url(url_text: &str) -> bool {
    let trimmed_url = url_text.trim();
    if !trimmed_url.contains("{{") {
        return is_http_url(trimmed_url);
    }
    ["http://", "https://", "{{"]
        .iter()
        .any(|allowed_start| trimmed_url.to_ascii_lowercase().starts_with(allowed_start))
}

/// The same rules as the edit sheet (WH-01.5): a name, an http(s) URL (templates allowed), a
/// valid Fields or Raw body, timeout 1 to 60 s, 1 to 10 attempts and retry delays of 1 s to 24 h.
pub fn validate_endpoint_input(
    endpoint_input: &WebhookEndpointInput,
) -> Result<(), OperationError> {
    let request_settings = &endpoint_input.request_settings;
    let retry_policy = &request_settings.retry_policy;
    if endpoint_input.name.trim().is_empty() {
        return Err(field_error("name", "Enter a name".to_owned()));
    }
    if !is_endpoint_url(&endpoint_input.url) {
        return Err(field_error(
            "url",
            "Enter an http:// or https:// URL".to_owned(),
        ));
    }
    if request_settings.body_mode == EndpointBodyMode::Fields {
        find_body_fields_error(&request_settings.body_fields)
            .map_or(Ok(()), |message| Err(field_error("body_fields", message)))?;
    }
    if request_settings.body_mode == EndpointBodyMode::Raw
        && request_settings.raw_content_type.trim().is_empty()
    {
        return Err(field_error(
            "raw_content_type",
            "Enter a content type".to_owned(),
        ));
    }
    if !is_within(request_settings.timeout_ms, TIMEOUT_LIMITS_MS) {
        return Err(field_error("timeout_ms", "Use 1 to 60 seconds".to_owned()));
    }
    if !is_within(retry_policy.max_attempts, MAX_ATTEMPT_LIMITS) {
        return Err(field_error(
            "retry_policy",
            "Use 1 to 10 attempts".to_owned(),
        ));
    }
    if retry_policy.max_attempts > 1 && retry_policy.backoff_seconds.is_empty() {
        return Err(field_error(
            "backoff_seconds",
            "Add at least one retry delay".to_owned(),
        ));
    }
    if retry_policy
        .backoff_seconds
        .iter()
        .any(|delay_seconds| !is_within(*delay_seconds, RETRY_DELAY_LIMITS_SECONDS))
    {
        return Err(field_error(
            "backoff_seconds",
            "Each delay must be 1 second to 24 hours".to_owned(),
        ));
    }
    Ok(())
}

/// Fields mode always encodes a valid body: named, unique fields whose fixed values fit their
/// type (WH-07.14).
fn find_body_fields_error(body_fields: &[EndpointBodyField]) -> Option<String> {
    if body_fields
        .iter()
        .any(|body_field| body_field.name.is_empty())
    {
        return Some("Every field needs a name".to_owned());
    }
    let mut seen_names = BTreeSet::new();
    if let Some(repeated_field) = body_fields
        .iter()
        .find(|body_field| !seen_names.insert(body_field.name.as_str()))
    {
        return Some(format!("{} is used twice", repeated_field.name));
    }
    body_fields.iter().find_map(find_fixed_value_error)
}

/// A fixed value (no `{{ }}`) that cannot become its type; rendered values are checked when
/// the request is rendered.
fn find_fixed_value_error(body_field: &EndpointBodyField) -> Option<String> {
    let field_value = body_field.value.trim();
    if field_value.contains("{{") {
        return None;
    }
    let fits_its_type = match body_field.value_type {
        BodyFieldType::Text => true,
        BodyFieldType::Number => field_value.parse::<f64>().is_ok_and(f64::is_finite),
        BodyFieldType::Boolean => field_value == "true" || field_value == "false",
        BodyFieldType::Json => serde_json::from_str::<serde_json::Value>(field_value).is_ok(),
    };
    let type_description = match body_field.value_type {
        BodyFieldType::Text => return None,
        BodyFieldType::Number => "a number",
        BodyFieldType::Boolean => "true or false",
        BodyFieldType::Json => "valid JSON",
    };
    (!fits_its_type).then(|| format!("{} must be {type_description}", body_field.name))
}
