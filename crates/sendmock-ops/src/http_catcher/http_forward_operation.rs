use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::sms::RecordedHttpRequest;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

/// A forwarded request gets as long as a webhook endpoint's default.
const FORWARD_TIMEOUT_MS: u32 = 10_000;
/// Headers that belong to the original connection, not to the request itself.
const CONNECTION_HEADERS: [&str; 4] = ["host", "content-length", "connection", "transfer-encoding"];

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct HttpForwardRequest {
    /// The captured request's ID, from `GET /api/v1/http/requests`.
    pub request_id: String,
    /// Where the captured request is sent again, e.g. your local handler.
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct HttpForwardResult {
    pub status_code: u16,
    pub duration_ms: u64,
    pub body: String,
}

pub struct ForwardHttpRequestOperation;

impl Operation for ForwardHttpRequestOperation {
    type Input = HttpForwardRequest;
    type Output = HttpForwardResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postHttpRequestsByRequestIdForward",
            method: HttpMethod::Post,
            path: "/api/v1/http/requests/{requestId}/forward",
            summary: "Send a captured request on to another URL.",
            cli_usage: "sendmock http forward <requestId>",
            mcp_tool: "sendmock_http_forward",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The same method, headers and body to another URL; its answer comes back (HC-01.5).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpForwardRequest,
    ) -> Result<HttpForwardResult, OperationError> {
        let target_url = input.url.trim();
        if !(target_url.starts_with("http://") || target_url.starts_with("https://")) {
            return Err(OperationError::InvalidInput {
                message: "Enter an http or https URL".to_owned(),
                field: Some("url".to_owned()),
            });
        }
        let forwarded_request =
            build_forwarded_request(operation_context, &input.request_id, target_url).await?;
        let webhook_sender =
            operation_context
                .webhook_sender
                .as_ref()
                .ok_or_else(|| OperationError::Upstream {
                    code: "forward_failed",
                    message: "This build cannot send HTTP requests".to_owned(),
                })?;
        let send_result = webhook_sender
            .send_webhook(&forwarded_request, FORWARD_TIMEOUT_MS)
            .await;
        match send_result.response {
            Some(response) => Ok(HttpForwardResult {
                status_code: response.status_code,
                duration_ms: send_result.duration_ms,
                body: response.body,
            }),
            None => Err(OperationError::Upstream {
                code: "forward_failed",
                message: send_result
                    .error_message
                    .unwrap_or_else(|| "The URL did not answer".to_owned()),
            }),
        }
    }
}

/// The captured request aimed at `target_url`, without its connection headers.
async fn build_forwarded_request(
    operation_context: &OperationContext,
    request_id: &str,
    target_url: &str,
) -> Result<RecordedHttpRequest, OperationError> {
    let captured_request = operation_context
        .http_catcher_stores
        .requests
        .find_request(request_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No captured request with id {request_id}"),
        })?;
    let headers: BTreeMap<String, String> =
        serde_json::from_str::<BTreeMap<String, String>>(&captured_request.headers_json)
            .unwrap_or_default()
            .into_iter()
            .filter(|(header_name, _)| !CONNECTION_HEADERS.contains(&header_name.as_str()))
            .collect();
    Ok(RecordedHttpRequest {
        method: captured_request.method,
        url: target_url.to_owned(),
        headers,
        body: captured_request.body,
    })
}
