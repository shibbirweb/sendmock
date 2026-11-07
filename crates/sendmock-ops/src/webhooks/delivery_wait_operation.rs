use std::time::Duration;

use sendmock_core::{parse_duration_ms, parse_rfc3339};
use sendmock_store::WebhookDeliveryFilter;

use super::delivery_detail::{WebhookDeliveryDetail, load_delivery_detail};
use super::delivery_inputs::WaitWebhookInput;
use super::delivery_operations::read_status_list;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

const DEFAULT_WAIT: Duration = Duration::from_secs(10);
const MAXIMUM_WAIT: Duration = Duration::from_secs(60);
const DEFAULT_LOOKBACK_MS: i64 = 30_000;
const WAIT_POLL_INTERVAL: Duration = Duration::from_millis(100);
/// Attempts that have finished, whatever the outcome.
const FINISHED_STATUSES: [&str; 4] = ["succeeded", "failed", "exhausted", "render_failed"];

fn invalid_input(field_name: &str, message: String) -> OperationError {
    OperationError::InvalidInput {
        message,
        field: Some(field_name.to_owned()),
    }
}

/// The endpoint by id or by name; an unknown one is a mistake in the request.
async fn resolve_endpoint_id(
    operation_context: &OperationContext,
    endpoint_text: &str,
) -> Result<String, OperationError> {
    operation_context
        .webhook_endpoint_repository
        .list_endpoints()
        .await?
        .into_iter()
        .find(|stored_endpoint| {
            stored_endpoint.endpoint_id == endpoint_text || stored_endpoint.name == endpoint_text
        })
        .map(|stored_endpoint| stored_endpoint.endpoint_id)
        .ok_or_else(|| {
            invalid_input(
                "endpoint",
                format!("No webhook endpoint named {endpoint_text}"),
            )
        })
}

async fn build_wait_filter(
    operation_context: &OperationContext,
    input: &WaitWebhookInput,
) -> Result<WebhookDeliveryFilter, OperationError> {
    let requested_statuses = read_status_list(input.status.as_deref());
    let endpoint_id = match input.endpoint.as_deref() {
        Some(endpoint_text) => Some(resolve_endpoint_id(operation_context, endpoint_text).await?),
        None => None,
    };
    let since_unix_ms = match input.since.as_deref() {
        Some(since_text) => parse_rfc3339(since_text).ok_or_else(|| {
            invalid_input(
                "since",
                format!("since must be a time such as 2026-10-26T09:30:00Z, not {since_text}"),
            )
        })?,
        None => operation_context.clock.now_unix_ms() - DEFAULT_LOOKBACK_MS,
    };
    Ok(WebhookDeliveryFilter {
        statuses: if requested_statuses.is_empty() {
            FINISHED_STATUSES.map(str::to_owned).to_vec()
        } else {
            requested_statuses
        },
        endpoint_id,
        event_type: input.event.clone(),
        created_after_unix_ms: Some(since_unix_ms),
    })
}

pub struct WaitForWebhookOperation;

impl Operation for WaitForWebhookOperation {
    type Input = WaitWebhookInput;
    type Output = WebhookDeliveryDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getWaitWebhook",
            method: HttpMethod::Get,
            path: "/api/v1/wait/webhook",
            summary: "Wait until a matching delivery finishes; 408 on timeout.",
            is_read_only: true,
            cli_usage: "sendmock webhook deliveries wait",
            mcp_tool: "sendmock_webhook_delivery_wait",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Polls for the newest finished attempt that matches, until the timeout (PL-03.1).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WaitWebhookInput,
    ) -> Result<WebhookDeliveryDetail, OperationError> {
        let wait_duration = match input.timeout.as_deref() {
            Some(timeout_text) => parse_duration_ms(timeout_text)
                .map(Duration::from_millis)
                .ok_or_else(|| {
                    invalid_input(
                        "timeout",
                        format!("timeout must be a duration such as 10s, not {timeout_text}"),
                    )
                })?,
            None => DEFAULT_WAIT,
        };
        let filter = build_wait_filter(operation_context, &input).await?;
        let deadline = tokio::time::Instant::now() + wait_duration.min(MAXIMUM_WAIT);
        loop {
            let page = operation_context
                .webhook_delivery_repository
                .list_deliveries(filter.clone(), None, 1)
                .await?;
            if let Some(finished_delivery) = page.deliveries.into_iter().next() {
                return load_delivery_detail(operation_context, finished_delivery).await;
            }
            if tokio::time::Instant::now() >= deadline {
                return Err(OperationError::Timeout {
                    message: "No matching webhook delivery finished in time".to_owned(),
                });
            }
            tokio::time::sleep(WAIT_POLL_INTERVAL).await;
        }
    }
}
