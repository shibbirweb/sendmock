use sendmock_store::{CallbackAttemptResult, SmsCallbackAttemptRecord};
use sendmock_webhooks::{AttemptDecision, AttemptOutcome, RetrySchedule};

use super::sms_views::RecordedHttpRequest;
use super::status_callback_sender::StatusCallbackResult;
use crate::{OperationContext, OperationError};

const NO_SENDER_MESSAGE: &str = "This build cannot make HTTP calls, so the callback was not sent";

/// Status callbacks are retried as webhooks are by default: 5 attempts in total, waiting 1s,
/// 5s, 30s, 2m and 10m, on `5xx` answers, timeouts and connection errors.
fn status_callback_retry_schedule() -> RetrySchedule {
    RetrySchedule {
        max_attempts: 5,
        backoff_seconds: vec![1, 5, 30, 120, 600],
        retry_on_client_errors: false,
    }
}

fn to_attempt_outcome(callback_result: &StatusCallbackResult) -> AttemptOutcome {
    match &callback_result.response {
        Some(response) => AttemptOutcome::Answered {
            status_code: response.status_code,
        },
        None => AttemptOutcome::ConnectionFailed,
    }
}

fn describe_decision(attempt_decision: AttemptDecision) -> (&'static str, Option<i64>) {
    match attempt_decision {
        AttemptDecision::Succeeded => ("succeeded", None),
        AttemptDecision::RetryAt {
            next_attempt_at_unix_ms,
        } => ("failed", Some(next_attempt_at_unix_ms)),
        AttemptDecision::Failed => ("failed", None),
        AttemptDecision::Exhausted => ("exhausted", None),
    }
}

/// How an attempt ended once it was sent, with the retry it schedules, if any.
fn build_sent_result(
    operation_context: &OperationContext,
    attempt: u32,
    callback_result: StatusCallbackResult,
) -> CallbackAttemptResult {
    let attempt_decision = status_callback_retry_schedule().decide_after_attempt(
        attempt,
        to_attempt_outcome(&callback_result),
        operation_context.clock.now_unix_ms(),
    );
    let (status, next_attempt_at_unix_ms) = describe_decision(attempt_decision);
    CallbackAttemptResult {
        status: status.to_owned(),
        response_json: callback_result
            .response
            .and_then(|recorded_response| serde_json::to_string(&recorded_response).ok()),
        duration_ms: Some(callback_result.duration_ms),
        error_message: callback_result.error_message,
        next_attempt_at_unix_ms,
    }
}

/// Without an HTTP client a retry cannot help, so the attempt fails for good.
fn build_unsent_result(error_message: String) -> CallbackAttemptResult {
    CallbackAttemptResult {
        status: "failed".to_owned(),
        response_json: None,
        duration_ms: None,
        error_message: Some(error_message),
        next_attempt_at_unix_ms: None,
    }
}

/// Sends an `in_flight` attempt's stored request and records how it ended, scheduling the
/// next attempt when it failed in a way that is retried.
pub async fn send_callback_attempt(
    operation_context: &OperationContext,
    in_flight_attempt: &SmsCallbackAttemptRecord,
) -> Result<(), OperationError> {
    let attempt_result = match (
        &operation_context.status_callback_sender,
        serde_json::from_str::<RecordedHttpRequest>(&in_flight_attempt.request_json),
    ) {
        (Some(status_callback_sender), Ok(callback_request)) => {
            let callback_result = status_callback_sender
                .send_status_callback(&callback_request)
                .await;
            build_sent_result(
                operation_context,
                in_flight_attempt.attempt,
                callback_result,
            )
        }
        (None, _) => build_unsent_result(NO_SENDER_MESSAGE.to_owned()),
        (_, Err(read_error)) => build_unsent_result(format!(
            "The stored callback request is unreadable: {read_error}"
        )),
    };
    let has_retry_due = attempt_result.next_attempt_at_unix_ms.is_some();
    operation_context
        .sms_callback_attempt_repository
        .finish_attempt(&in_flight_attempt.attempt_id, attempt_result)
        .await?;
    if has_retry_due {
        operation_context
            .status_callback_dispatch_signal
            .notify_one();
    }
    Ok(())
}
