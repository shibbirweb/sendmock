use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde_json::{Value, json};

use super::message_provider_definition::MessageProviderDefinition;
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};

/// A JSON answer with its status.
pub fn answer_json(status: u16, body: Value) -> ProviderHttpResponse {
    ProviderHttpResponse {
        status,
        headers: vec![("Content-Type".to_owned(), "application/json".to_owned())],
        body: body.to_string(),
    }
}

pub fn answer_no_content() -> ProviderHttpResponse {
    ProviderHttpResponse {
        status: 204,
        headers: Vec::new(),
        body: String::new(),
    }
}

/// Twilio's error JSON: code, message, a link to the error's page, and the status.
pub fn answer_twilio_error(status: u16, error_code: u32, message: &str) -> ProviderHttpResponse {
    answer_json(
        status,
        json!({
            "code": error_code,
            "message": message,
            "more_info": format!("https://www.twilio.com/docs/errors/{error_code}"),
            "status": status,
        }),
    )
}

/// A trimmed, non-empty form field.
pub fn read_form_field(fields: &Value, field_name: &str) -> Option<String> {
    fields
        .get(field_name)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

/// The account in the Basic auth user name (`AC...`), or the definition's.
pub fn read_account_sid(
    provider: &MessageProviderDefinition,
    request: &ProviderHttpRequest,
) -> String {
    request
        .header("authorization")
        .and_then(|authorization| authorization.strip_prefix("Basic "))
        .and_then(|encoded| STANDARD.decode(encoded.trim()).ok())
        .and_then(|decoded| String::from_utf8(decoded).ok())
        .and_then(|credentials| credentials.split(':').next().map(str::to_owned))
        .filter(|user_name| user_name.starts_with("AC"))
        .or_else(|| provider.find_credential("account_sid").map(str::to_owned))
        .unwrap_or_default()
}

/// The meta block of Twilio's v1 and v2 list pages.
pub fn describe_page_meta(list_url: &str, collection_key: &str) -> Value {
    let page_url = format!("{list_url}?PageSize=50&Page=0");
    json!({
        "page": 0,
        "page_size": 50,
        "first_page_url": page_url,
        "previous_page_url": Value::Null,
        "url": page_url,
        "next_page_url": Value::Null,
        "key": collection_key,
    })
}
