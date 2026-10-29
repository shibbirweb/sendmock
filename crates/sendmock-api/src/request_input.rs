use axum::body::Bytes;
use sendmock_ops::{ErasedOperation, HttpMethod, build_input_from_text};
use serde_json::{Map, Value};

use crate::api_error_response::ApiErrorResponse;

const FORM_CONTENT_TYPE: &str = "application/x-www-form-urlencoded";

/// The pieces of a request an operation's input is built from.
pub struct RequestParts {
    pub path_parameters: Vec<(String, String)>,
    pub query_parameters: Vec<(String, String)>,
    pub content_type: Option<String>,
    pub body: Bytes,
    /// False for a `GET` alias of a body operation, which reads the query string instead.
    pub reads_body: bool,
}

/// The JSON or form body (or the raw body in its input field), with the query and path
/// values converted to the input's types on top; path values win, since they name the item.
pub fn assemble_input(
    operation: &dyn ErasedOperation,
    input_schema: &Value,
    request_parts: RequestParts,
) -> Result<Value, ApiErrorResponse> {
    let definition = operation.definition();
    let is_form_body = request_parts
        .content_type
        .as_deref()
        .is_some_and(|content_type| content_type.starts_with(FORM_CONTENT_TYPE));
    let reads_body = request_parts.reads_body && has_body(definition.method);
    let mut text_values: Vec<(String, String)> = Vec::new();
    let mut input = match definition.raw_body_input {
        Some(raw_body_input) if reads_body => {
            let mut raw_input = Map::new();
            let body_text = String::from_utf8_lossy(&request_parts.body).into_owned();
            raw_input.insert(
                raw_body_input.input_name.to_owned(),
                Value::String(body_text),
            );
            raw_input
        }
        None if reads_body && is_form_body => {
            text_values.extend(parse_form_body(&request_parts.body)?);
            Map::new()
        }
        None if reads_body => parse_json_body(&request_parts.body)?,
        _ => Map::new(),
    };
    text_values.extend(request_parts.query_parameters);
    text_values.extend(request_parts.path_parameters);
    input
        .extend(build_input_from_text(input_schema, &text_values).map_err(ApiErrorResponse::from)?);
    Ok(Value::Object(input))
}

pub fn has_body(method: HttpMethod) -> bool {
    matches!(
        method,
        HttpMethod::Post | HttpMethod::Put | HttpMethod::Patch
    )
}

/// `a=1&b=2&b=3` as pairs; a repeated key fills a list input.
fn parse_form_body(request_body: &[u8]) -> Result<Vec<(String, String)>, ApiErrorResponse> {
    serde_urlencoded::from_bytes(request_body).map_err(|parse_error| {
        ApiErrorResponse::invalid_json_body(&format!("the form body is not valid: {parse_error}"))
    })
}

/// An empty body counts as `{}`, so operations with only optional fields need no body.
fn parse_json_body(request_body: &[u8]) -> Result<Map<String, Value>, ApiErrorResponse> {
    if request_body.is_empty() {
        return Ok(Map::new());
    }
    match serde_json::from_slice(request_body) {
        Ok(Value::Object(body_fields)) => Ok(body_fields),
        Ok(_) => Err(ApiErrorResponse::invalid_json_body(
            "expected a JSON object",
        )),
        Err(parse_error) => Err(ApiErrorResponse::invalid_json_body(
            &parse_error.to_string(),
        )),
    }
}
