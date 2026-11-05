use std::time::Duration;

use schemars::JsonSchema;
use sendmock_core::{parse_duration_ms, parse_rfc3339};
use sendmock_store::PaymentListFilter;
use serde::Deserialize;

use super::payment_catalogue::read_payment_document;
use super::payment_notification::refresh_notification_statuses;
use super::payment_views::PaymentDetail;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

const DEFAULT_WAIT: Duration = Duration::from_secs(10);
const MAXIMUM_WAIT: Duration = Duration::from_secs(60);
const DEFAULT_LOOKBACK_MS: i64 = 30_000;
const WAIT_POLL_INTERVAL: Duration = Duration::from_millis(100);

/// Query of `GET /api/v1/wait/payment`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WaitPaymentInput {
    /// The gateway key, e.g. stripe.
    pub provider: Option<String>,
    /// The status to wait for, e.g. succeeded.
    pub status: Option<String>,
    /// Only match items newer than this time (default: 30 s ago).
    pub since: Option<String>,
    /// How long to wait, e.g. 10s (default 10s, at most 60s).
    pub timeout: Option<String>,
}

fn invalid_input(field_name: &str, message: String) -> OperationError {
    OperationError::InvalidInput {
        message,
        field: Some(field_name.to_owned()),
    }
}

fn read_wait_duration(input: &WaitPaymentInput) -> Result<Duration, OperationError> {
    let Some(timeout_text) = input.timeout.as_deref() else {
        return Ok(DEFAULT_WAIT);
    };
    parse_duration_ms(timeout_text)
        .map(|timeout_ms| Duration::from_millis(timeout_ms).min(MAXIMUM_WAIT))
        .ok_or_else(|| {
            invalid_input(
                "timeout",
                format!("timeout must be a duration such as 10s, not {timeout_text}"),
            )
        })
}

fn read_since_unix_ms(
    operation_context: &OperationContext,
    input: &WaitPaymentInput,
) -> Result<i64, OperationError> {
    let Some(since_text) = input.since.as_deref() else {
        return Ok(operation_context.clock.now_unix_ms() - DEFAULT_LOOKBACK_MS);
    };
    parse_rfc3339(since_text).ok_or_else(|| {
        invalid_input(
            "since",
            format!("since must be a time such as 2026-10-26T09:30:00Z, not {since_text}"),
        )
    })
}

/// The newest payment that matches, when it was made since then.
async fn find_matching_payment(
    operation_context: &OperationContext,
    filter: &PaymentListFilter,
    since_unix_ms: i64,
) -> Result<Option<PaymentDetail>, OperationError> {
    let page = operation_context
        .payment_repository
        .list_payments(filter.clone(), None, 1)
        .await?;
    let Some(newest_payment) = page.payments.first() else {
        return Ok(None);
    };
    let payment = read_payment_document(newest_payment)?;
    let created_unix_ms = parse_rfc3339(&payment.summary.created_at).unwrap_or_default();
    Ok((created_unix_ms >= since_unix_ms).then_some(payment))
}

pub struct WaitForPaymentOperation;

impl Operation for WaitForPaymentOperation {
    type Input = WaitPaymentInput;
    type Output = PaymentDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getWaitPayment",
            method: HttpMethod::Get,
            path: "/api/v1/wait/payment",
            summary: "Wait until a payment reaches a status; 408 on timeout.",
            is_read_only: true,
            cli_usage: "sendmock payments wait",
            mcp_tool: "sendmock_payment_wait",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Polls for the newest payment made since `since` with the provider and status asked
    /// for, until the timeout (PY-11.3).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WaitPaymentInput,
    ) -> Result<PaymentDetail, OperationError> {
        let wait_duration = read_wait_duration(&input)?;
        let since_unix_ms = read_since_unix_ms(operation_context, &input)?;
        let filter = PaymentListFilter {
            statuses: input.status.clone().into_iter().collect(),
            provider: input.provider.clone(),
            currency: None,
        };
        let deadline = tokio::time::Instant::now() + wait_duration;
        loop {
            if let Some(mut payment) =
                find_matching_payment(operation_context, &filter, since_unix_ms).await?
            {
                refresh_notification_statuses(operation_context, &mut payment).await?;
                return Ok(payment);
            }
            if tokio::time::Instant::now() >= deadline {
                return Err(OperationError::Timeout {
                    message: "No matching payment reached the status in time".to_owned(),
                });
            }
            tokio::time::sleep(WAIT_POLL_INTERVAL).await;
        }
    }
}
