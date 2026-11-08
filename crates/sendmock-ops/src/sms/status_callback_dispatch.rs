use std::time::Duration;

use sendmock_store::SmsCallbackAttemptRecord;

use super::status_callback_attempt::send_callback_attempt;
use crate::{OperationContext, OperationError};

/// How long an idle dispatcher sleeps before looking again, in case a wake-up was missed.
const IDLE_WAIT_MS: i64 = 30_000;

/// Claims a due row: a `pending` row itself, or the next attempt's new row for a `failed`
/// one. None when another pass got there first.
async fn claim_due_attempt(
    operation_context: &OperationContext,
    due_attempt: SmsCallbackAttemptRecord,
    now_unix_ms: i64,
) -> Result<Option<SmsCallbackAttemptRecord>, OperationError> {
    let attempt_repository = &operation_context.sms_callback_attempt_repository;
    if due_attempt.status == "pending" {
        let was_claimed = attempt_repository
            .start_pending_attempt(&due_attempt.attempt_id)
            .await?;
        return Ok(was_claimed.then(|| SmsCallbackAttemptRecord {
            status: "in_flight".to_owned(),
            next_attempt_at_unix_ms: None,
            ..due_attempt
        }));
    }
    let retry_attempt = SmsCallbackAttemptRecord {
        attempt_id: operation_context.id_generator.generate_id().to_string(),
        attempt: due_attempt.attempt + 1,
        status: "in_flight".to_owned(),
        response_json: None,
        duration_ms: None,
        error_message: None,
        next_attempt_at_unix_ms: None,
        created_at_unix_ms: now_unix_ms,
        ..due_attempt.clone()
    };
    let was_claimed = attempt_repository
        .start_retry_attempt(&due_attempt.attempt_id, retry_attempt.clone())
        .await?;
    Ok(was_claimed.then_some(retry_attempt))
}

/// One pass over the callback queue: claims up to `max_concurrent_callbacks` due rows and
/// sends them at the same time. Answers how many attempts ran.
pub async fn run_due_status_callbacks(
    operation_context: &OperationContext,
    max_concurrent_callbacks: u32,
) -> Result<usize, OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let due_attempts = operation_context
        .sms_callback_attempt_repository
        .list_due_attempts(now_unix_ms, max_concurrent_callbacks)
        .await?;
    let mut send_tasks = tokio::task::JoinSet::new();
    for due_attempt in due_attempts {
        let Some(in_flight_attempt) =
            claim_due_attempt(operation_context, due_attempt, now_unix_ms).await?
        else {
            continue;
        };
        let task_context = operation_context.clone();
        send_tasks
            .spawn(async move { send_callback_attempt(&task_context, &in_flight_attempt).await });
    }
    let attempt_count = send_tasks.len();
    while let Some(task_result) = send_tasks.join_next().await {
        task_result.map_err(|join_error| OperationError::Internal(join_error.to_string()))??;
    }
    Ok(attempt_count)
}

/// The background dispatcher the binary runs: puts callbacks a stopped process left in flight
/// back in the queue, then sends retries until the process stops, waking when one is scheduled
/// or comes due.
pub async fn run_status_callback_dispatcher(
    operation_context: OperationContext,
    max_concurrent_callbacks: u32,
) {
    let attempt_repository = &operation_context.sms_callback_attempt_repository;
    if let Err(requeue_error) = attempt_repository
        .requeue_in_flight(operation_context.clock.now_unix_ms())
        .await
    {
        tracing::warn!(error = %requeue_error, "could not queue unfinished status callbacks again");
    }
    loop {
        let attempt_count = run_due_status_callbacks(&operation_context, max_concurrent_callbacks)
            .await
            .unwrap_or_else(|dispatch_error| {
                tracing::warn!(error = %dispatch_error, "status callback pass failed");
                0
            });
        if attempt_count > 0 {
            continue;
        }
        let now_unix_ms = operation_context.clock.now_unix_ms();
        let wait_ms = match attempt_repository.find_next_due_time().await {
            Ok(Some(next_due_unix_ms)) => (next_due_unix_ms - now_unix_ms).clamp(0, IDLE_WAIT_MS),
            _ => IDLE_WAIT_MS,
        };
        tokio::select! {
            () = operation_context.dispatch_signals.status_callbacks.notified() => {}
            () = tokio::time::sleep(Duration::from_millis(u64::try_from(wait_ms).unwrap_or(0))) => {}
        }
    }
}
