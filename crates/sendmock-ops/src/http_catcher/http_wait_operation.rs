use std::time::Duration;

use schemars::JsonSchema;
use sendmock_core::parse_rfc3339;
use serde::Deserialize;

use super::http_catcher_views::present_captured_request;
use super::http_catcher_wire::CapturedHttpRequest;
use crate::email::read_wait_duration;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

const DEFAULT_WAIT: Duration = Duration::from_secs(10);
const LONGEST_WAIT: Duration = Duration::from_secs(60);
/// A match may be this old when `since` is not given.
const DEFAULT_LOOKBACK_MS: i64 = 30_000;
const WAIT_POLL_INTERVAL: Duration = Duration::from_millis(200);

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct HttpWaitQuery {
    /// The bin name.
    pub bin: Option<String>,
    /// The HTTP method.
    pub method: Option<String>,
    /// Only match items newer than this time (default: 30 s ago).
    pub since: Option<String>,
    /// How long to wait, e.g. 10s (default 10s, at most 60s).
    pub timeout: Option<String>,
}

pub struct WaitForHttpRequestOperation;

impl Operation for WaitForHttpRequestOperation {
    type Input = HttpWaitQuery;
    type Output = CapturedHttpRequest;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getWaitHttp",
            method: HttpMethod::Get,
            path: "/api/v1/wait/http",
            summary: "Wait until the catcher records a matching request; 408 on timeout.",
            is_read_only: true,
            cli_usage: "sendmock http wait",
            mcp_tool: "sendmock_http_wait",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Answers as soon as a match is stored, or `408` after the timeout (PL-03.1, PL-03.2).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: HttpWaitQuery,
    ) -> Result<CapturedHttpRequest, OperationError> {
        let wait_duration =
            read_wait_duration(input.timeout.as_deref(), DEFAULT_WAIT)?.min(LONGEST_WAIT);
        let since_unix_ms = match input.since.as_deref() {
            Some(since_text) => {
                parse_rfc3339(since_text).ok_or_else(|| OperationError::InvalidInput {
                    message: format!(
                        "since must be a time such as 2026-10-26T09:30:00Z, not {since_text}"
                    ),
                    field: Some("since".to_owned()),
                })?
            }
            None => operation_context.clock.now_unix_ms() - DEFAULT_LOOKBACK_MS,
        };
        let wait_deadline = tokio::time::Instant::now() + wait_duration;
        loop {
            if let Some(matching_request) =
                find_newest_match(operation_context, &input, since_unix_ms).await?
            {
                return Ok(matching_request);
            }
            if tokio::time::Instant::now() >= wait_deadline {
                return Err(OperationError::Timeout {
                    message: format!(
                        "No matching request arrived within {} ms",
                        wait_duration.as_millis()
                    ),
                });
            }
            tokio::time::sleep(WAIT_POLL_INTERVAL).await;
        }
    }
}

async fn find_newest_match(
    operation_context: &OperationContext,
    input: &HttpWaitQuery,
    since_unix_ms: i64,
) -> Result<Option<CapturedHttpRequest>, OperationError> {
    let bin_id = match input.bin.as_deref() {
        Some(bin_name) => match operation_context
            .http_catcher_stores
            .bins
            .find_bin_by_name(bin_name)
            .await?
        {
            Some(http_bin) => Some(http_bin.bin_id),
            None => return Ok(None),
        },
        None => None,
    };
    let recent_requests = operation_context
        .http_catcher_stores
        .requests
        .list_requests(bin_id, None, 50)
        .await?;
    Ok(recent_requests
        .into_iter()
        .filter(|captured_request| captured_request.created_at_unix_ms >= since_unix_ms)
        .find(|captured_request| {
            input
                .method
                .as_deref()
                .is_none_or(|method| captured_request.method.eq_ignore_ascii_case(method))
        })
        .map(present_captured_request))
}
