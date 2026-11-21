use sendmock_store::{CallbackAttemptResult, SmsCallbackAttemptRecord};
use sendmock_webhooks::{AttemptDecision, AttemptOutcome, RetrySchedule};

use super::http_call_result::HttpCallResult;
use super::sms_views::{RecordedHttpRequest, RecordedHttpResponse};
use crate::twilio_accounts::{DEBUGGER_REPORTED_STATUS, DebuggerProblem, send_debugger_event};
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

fn to_attempt_outcome(callback_result: &HttpCallResult) -> AttemptOutcome {
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
    callback_result: HttpCallResult,
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
    let is_first_failure = in_flight_attempt.attempt == 1 && attempt_result.status != "succeeded";
    let failed_response = attempt_result
        .response_json
        .as_deref()
        .and_then(|response_json| serde_json::from_str::<RecordedHttpResponse>(response_json).ok());
    operation_context
        .sms_delivery_stores
        .callback_attempts
        .finish_attempt(&in_flight_attempt.attempt_id, attempt_result)
        .await?;
    if is_first_failure && in_flight_attempt.reported_status != DEBUGGER_REPORTED_STATUS {
        report_failed_callback(
            operation_context,
            in_flight_attempt,
            failed_response.as_ref(),
        )
        .await?;
    }
    if has_retry_due {
        operation_context
            .dispatch_signals
            .status_callbacks
            .notify_one();
    }
    Ok(())
}

/// A Twilio message's status callback that failed sends one Debugger event with error 11200,
/// as Twilio does; the event itself is never reported again.
async fn report_failed_callback(
    operation_context: &OperationContext,
    failed_attempt: &SmsCallbackAttemptRecord,
    failed_response: Option<&RecordedHttpResponse>,
) -> Result<(), OperationError> {
    let Ok(callback_request) =
        serde_json::from_str::<RecordedHttpRequest>(&failed_attempt.request_json)
    else {
        return Ok(());
    };
    let Some(sms) = operation_context
        .sms_repository
        .find_message(&failed_attempt.sms_id)
        .await?
    else {
        return Ok(());
    };
    if sms.api != "twilio" {
        return Ok(());
    }
    // Boxed because the Debugger event is itself sent as a callback attempt.
    Box::pin(send_debugger_event(
        operation_context,
        &sms,
        DebuggerProblem::FailedWebhook {
            request: &callback_request,
            response: failed_response,
        },
    ))
    .await
}
