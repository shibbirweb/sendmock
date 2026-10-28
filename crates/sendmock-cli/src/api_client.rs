use sendmock_ops::{HttpMethod, OperationDefinition};
use serde::Deserialize;
use serde_json::Value;

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

    pub async fn call_operation(
        &self,
        definition: &OperationDefinition,
        input: &Value,
    ) -> Result<Value, CliError> {
        let request_url = format!("{}{}", self.server_url, definition.path);
        let mut request = match definition.method {
            HttpMethod::Get => self.http_client.get(&request_url),
            HttpMethod::Delete => self.http_client.delete(&request_url),
            HttpMethod::Post => self.http_client.post(&request_url).json(input),
            HttpMethod::Put => self.http_client.put(&request_url).json(input),
            HttpMethod::Patch => self.http_client.patch(&request_url).json(input),
        };
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
        let http_status = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|read_error| CliError::UnreadableAnswer(read_error.to_string()))?;
        if http_status.is_success() {
            return serde_json::from_str(&response_text)
                .map_err(|parse_error| CliError::UnreadableAnswer(parse_error.to_string()));
        }
        let error_body: ApiErrorBody = serde_json::from_str(&response_text)
            .map_err(|_| CliError::UnreadableAnswer(response_text.clone()))?;
        Err(CliError::Api {
            http_status: http_status.as_u16(),
            code: error_body.error.code,
            message: error_body.error.message,
        })
    }
}
