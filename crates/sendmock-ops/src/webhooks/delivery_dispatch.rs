use std::time::Duration;

use sendmock_store::WebhookDeliveryRecord;
use sendmock_webhooks::{AttemptDecision, AttemptOutcome, RetrySchedule};

use super::delivery_attempt_recording::{record_attempt, record_unsent_attempt};
use super::delivery_signing::sign_delivery_request;
use super::endpoint_settings::RetryPolicy;
use super::endpoint_view::read_request_settings;
use super::webhook_sender::{WebhookSendFailure, WebhookSendResult};
use crate::{OperationContext, OperationError, RecordedHttpRequest};

/// How long an idle dispatcher sleeps before looking again, in case a wake-up was missed.
const IDLE_WAIT_MS: i64 = 30_000;

fn internal_error(message: impl ToString) -> OperationError {
    OperationError::Internal(message.to_string())
}

/// Claims a due row: a `pending` row itself, or the next attempt's new row for a `failed`
/// one. None when another pass or a cancel got there first.
async fn claim_due_delivery(
    operation_context: &OperationContext,
    due_delivery: WebhookDeliveryRecord,
    now_unix_ms: i64,
) -> Result<Option<WebhookDeliveryRecord>, OperationError> {
    let delivery_repository = &operation_context.webhook_delivery_repository;
    if due_delivery.status == "pending" {
        let was_claimed = delivery_repository
            .start_pending_attempt(&due_delivery.delivery_id)
            .await?;
        return Ok(was_claimed.then(|| WebhookDeliveryRecord {
            status: "in_flight".to_owned(),
            next_attempt_at_unix_ms: None,
            ..due_delivery
        }));
    }
    let retry_delivery = WebhookDeliveryRecord {
        delivery_id: operation_context.id_generator.generate_id().to_string(),
        attempt: due_delivery.attempt + 1,
        status: "in_flight".to_owned(),
        sent_request_json: None,
        response_json: None,
        duration_ms: None,
        error_message: None,
        next_attempt_at_unix_ms: None,
        created_at_unix_ms: now_unix_ms,
        ..due_delivery.clone()
    };
    let was_claimed = delivery_repository
        .start_retry_attempt(&due_delivery.delivery_id, retry_delivery.clone())
        .await?;
    Ok(was_claimed.then_some(retry_delivery))
}

fn to_attempt_outcome(send_result: &WebhookSendResult) -> AttemptOutcome {
    match (&send_result.response, send_result.failure) {
        (Some(response), _) => AttemptOutcome::Answered {
            status_code: response.status_code,
        },
        (None, Some(WebhookSendFailure::TimedOut)) => AttemptOutcome::TimedOut,
        (None, _) => AttemptOutcome::ConnectionFailed,
    }
}

async fn send_signed_request(
    operation_context: &OperationContext,
    sent_request: &RecordedHttpRequest,
    timeout_ms: u32,
) -> WebhookSendResult {
    match &operation_context.webhook_sender {
        Some(webhook_sender) => webhook_sender.send_webhook(sent_request, timeout_ms).await,
        None => WebhookSendResult {
            response: None,
            failure: Some(WebhookSendFailure::ConnectionFailed),
            error_message: Some("This build cannot send HTTP requests".to_owned()),
            duration_ms: 0,
        },
    }
}

/// The endpoint's retry policy as it was when the event was queued.
fn read_retry_schedule(
    in_flight_delivery: &WebhookDeliveryRecord,
) -> Result<RetrySchedule, OperationError> {
    let retry_policy: RetryPolicy =
        serde_json::from_str(&in_flight_delivery.retry_policy_json).map_err(internal_error)?;
    Ok(RetrySchedule {
        max_attempts: retry_policy.max_attempts,
        backoff_seconds: retry_policy.backoff_seconds,
        retry_on_client_errors: retry_policy.retry_on_client_errors,
    })
}

/// Signs and sends one claimed attempt, then records it with the retry decision.
async fn send_delivery_attempt(
    operation_context: &OperationContext,
    in_flight_delivery: &WebhookDeliveryRecord,
) -> Result<AttemptDecision, OperationError> {
    let started_at_unix_ms = operation_context.clock.now_unix_ms();
    let stored_endpoint = operation_context
        .webhook_endpoint_repository
        .find_endpoint(&in_flight_delivery.endpoint_id)
        .await?
        .ok_or_else(|| internal_error("The endpoint was deleted"))?;
    let rendered_request: RecordedHttpRequest = in_flight_delivery
        .rendered_request_json
        .as_deref()
        .map(serde_json::from_str)
        .transpose()
        .map_err(internal_error)?
        .ok_or_else(|| internal_error("The delivery has no rendered request"))?;
    let sent_request = sign_delivery_request(
        &rendered_request,
        &stored_endpoint,
        &in_flight_delivery.event_id,
        in_flight_delivery.attempt,
        started_at_unix_ms,
    )?;
    let timeout_ms = read_request_settings(&stored_endpoint)?.timeout_ms;
    let send_result = send_signed_request(operation_context, &sent_request, timeout_ms).await;
    let attempt_decision = read_retry_schedule(in_flight_delivery)?.decide_after_attempt(
        in_flight_delivery.attempt,
        to_attempt_outcome(&send_result),
        operation_context.clock.now_unix_ms(),
    );
    record_attempt(
        operation_context,
        in_flight_delivery,
        &sent_request,
        send_result,
        attempt_decision,
    )
    .await?;
    Ok(attempt_decision)
}

/// One pass over the queue: claims up to `max_concurrent_deliveries` due rows and sends them
/// at the same time, so no more than that many are ever in flight (WH-03.6). Answers how many
/// attempts ran.
pub async fn run_due_deliveries(
    operation_context: &OperationContext,
    max_concurrent_deliveries: u32,
) -> Result<usize, OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let due_deliveries = operation_context
        .webhook_delivery_repository
        .list_due_deliveries(now_unix_ms, max_concurrent_deliveries)
        .await?;
    let mut send_tasks = tokio::task::JoinSet::new();
    for due_delivery in due_deliveries {
        let Some(in_flight_delivery) =
            claim_due_delivery(operation_context, due_delivery, now_unix_ms).await?
        else {
            continue;
        };
        let task_context = operation_context.clone();
        send_tasks.spawn(async move {
            if let Err(send_error) = send_delivery_attempt(&task_context, &in_flight_delivery).await
            {
                record_unsent_attempt(&task_context, &in_flight_delivery, &send_error).await?;
            }
            Ok::<(), OperationError>(())
        });
    }
    let attempt_count = send_tasks.len();
    while let Some(task_result) = send_tasks.join_next().await {
        task_result.map_err(internal_error)??;
    }
    Ok(attempt_count)
}

/// The background dispatcher the binary runs: puts rows a stopped process left in flight back
/// in the queue (WH-03.3), then sends due rows until the process stops, waking when a delivery
/// is queued or the next retry comes due.
pub async fn run_webhook_dispatcher(
    operation_context: OperationContext,
    max_concurrent_deliveries: u32,
) {
    let delivery_repository = &operation_context.webhook_delivery_repository;
    if let Err(requeue_error) = delivery_repository
        .requeue_in_flight(operation_context.clock.now_unix_ms())
        .await
    {
        tracing::warn!(error = %requeue_error, "could not queue unfinished webhook deliveries again");
    }
    loop {
        let attempt_count = run_due_deliveries(&operation_context, max_concurrent_deliveries)
            .await
            .unwrap_or_else(|dispatch_error| {
                tracing::warn!(error = %dispatch_error, "webhook delivery pass failed");
                0
            });
        if attempt_count > 0 {
            continue;
        }
        let now_unix_ms = operation_context.clock.now_unix_ms();
        let wait_ms = match delivery_repository.find_next_due_time().await {
            Ok(Some(next_due_unix_ms)) => (next_due_unix_ms - now_unix_ms).clamp(0, IDLE_WAIT_MS),
            _ => IDLE_WAIT_MS,
        };
        tokio::select! {
            () = operation_context.webhook_dispatch_signal.notified() => {}
            () = tokio::time::sleep(Duration::from_millis(u64::try_from(wait_ms).unwrap_or(0))) => {}
        }
    }
}
