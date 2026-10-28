use sendmock_ops::{AnswerKind, HttpMethod, OperationDefinition, SuccessStatus};
use serde::Deserialize;
use serde_json::{Map, Value};

use crate::CliError;

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    error: ApiErrorDetail,
}

#[derive(Debug, Deserialize)]
struct ApiErrorDetail {
    code: String,
    message: String,
}

/// What the server answered: JSON, a file's bytes, or nothing.
#[derive(Debug, PartialEq)]
pub enum ApiAnswer {
    Json(Value),
    File(Vec<u8>),
    Empty,
}

/// Calls operations on a running SendMock through its REST API.
pub struct ApiClient {
    http_client: reqwest::Client,
    server_url: String,
    token: Option<String>,
}

impl ApiClient {
    pub fn new(server_url: String, token: Option<String>) -> Self {
        Self {
            http_client: reqwest::Client::new(),
            server_url,
            token,
        }
    }

    /// Puts path values in the URL, the other inputs in the query string or the body.
    pub async fn call_operation(
        &self,
        definition: &OperationDefinition,
        input: &Value,
    ) -> Result<ApiAnswer, CliError> {
        let mut request = self.build_request(definition, input);
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        let response = request
            .send()
            .await
            .map_err(|send_error| CliError::ServerUnreachable {
                server_url: self.server_url.clone(),
                reason: send_error.to_string(),
            })?;
        read_answer(definition, response).await
    }

    fn build_request(
        &self,
        definition: &OperationDefinition,
        input: &Value,
    ) -> reqwest::RequestBuilder {
        let mut remaining_input = input.as_object().cloned().unwrap_or_default();
        let request_url = format!(
            "{}{}",
            self.server_url,
            fill_path(definition, &mut remaining_input)
        );
        match definition.method {
            HttpMethod::Get => self
                .http_client
                .get(&request_url)
                .query(&to_query_pairs(&remaining_input)),
            HttpMethod::Delete => self
                .http_client
                .delete(&request_url)
                .query(&to_query_pairs(&remaining_input)),
            HttpMethod::Post | HttpMethod::Put | HttpMethod::Patch => {
                let request = match definition.method {
                    HttpMethod::Put => self.http_client.put(&request_url),
                    HttpMethod::Patch => self.http_client.patch(&request_url),
                    _ => self.http_client.post(&request_url),
                };
                match definition.raw_body_input {
                    Some(raw_body_input) => request
                        .header("content-type", raw_body_input.content_type)
                        .body(
                            remaining_input
                                .get(raw_body_input.input_name)
                                .map(to_text)
                                .unwrap_or_default(),
                        ),
                    None => request.json(&Value::Object(remaining_input)),
                }
            }
        }
    }
}

/// The path with its `{placeholders}` filled from the input, which keeps the other values.
fn fill_path(definition: &OperationDefinition, remaining_input: &mut Map<String, Value>) -> String {
    let mut request_path = definition.path.to_owned();
    for (placeholder, input_name) in definition.path_parameter_names() {
        let path_value = remaining_input
            .remove(&input_name)
            .map(|value| to_text(&value))
            .unwrap_or_default();
        request_path = request_path.replace(&format!("{{{placeholder}}}"), &path_value);
    }
    request_path
}

async fn read_answer(
    definition: &OperationDefinition,
    response: reqwest::Response,
) -> Result<ApiAnswer, CliError> {
    let http_status = response.status();
    let response_bytes = response
        .bytes()
        .await
        .map_err(|read_error| CliError::UnreadableAnswer(read_error.to_string()))?;
    if !http_status.is_success() {
        let error_body: ApiErrorBody = serde_json::from_slice(&response_bytes).map_err(|_| {
            CliError::UnreadableAnswer(String::from_utf8_lossy(&response_bytes).into_owned())
        })?;
        return Err(CliError::Api {
            http_status: http_status.as_u16(),
            code: error_body.error.code,
            message: error_body.error.message,
        });
    }
    if definition.success_status == SuccessStatus::NoContent {
        return Ok(ApiAnswer::Empty);
    }
    match definition.answer_kind {
        AnswerKind::File { .. } => Ok(ApiAnswer::File(response_bytes.to_vec())),
        AnswerKind::Json => serde_json::from_slice(&response_bytes)
            .map(ApiAnswer::Json)
            .map_err(|parse_error| CliError::UnreadableAnswer(parse_error.to_string())),
    }
}

fn to_text(value: &Value) -> String {
    value
        .as_str()
        .map_or_else(|| value.to_string(), str::to_owned)
}

/// Lists repeat their name; everything else is sent as text.
fn to_query_pairs(input: &Map<String, Value>) -> Vec<(String, String)> {
    input
        .iter()
        .flat_map(|(input_name, value)| match value {
            Value::Array(items) => items
                .iter()
                .map(|item| (input_name.clone(), to_text(item)))
                .collect::<Vec<_>>(),
            Value::Null => Vec::new(),
            other => vec![(input_name.clone(), to_text(other))],
        })
        .collect()
}
