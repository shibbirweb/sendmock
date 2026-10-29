use std::collections::BTreeMap;

use sendmock_store::{SmsCallbackAttemptRecord, SmsRecord, SmsStatusChangeRecord};

use super::sms_views::RecordedHttpRequest;
use crate::providers::{ProviderCallback, render_provider_status_callback};
use crate::{OperationContext, OperationError};

/// Phase 2 makes one attempt; Phase 3 moves callbacks onto the webhook queue with retries.
const FIRST_ATTEMPT: u32 = 1;
const NO_SENDER_MESSAGE: &str = "This build cannot make HTTP calls, so the callback was not sent";

/// Calls the message's status callback URL for one status change, in its provider's format
/// (SendMock's JSON for the native API), and records the attempt on the message. Does nothing
/// for a message without a callback URL, or a status its provider does not report.
pub async fn send_status_callback(
    operation_context: &OperationContext,
    sms: &SmsRecord,
    status_change: &SmsStatusChangeRecord,
) -> Result<(), OperationError> {
    let Some(callback_url) = sms.status_callback_url.as_deref() else {
        return Ok(());
    };
    let callback_request = match render_provider_status_callback(
        operation_context,
        sms,
        callback_url,
        status_change,
    ) {
        ProviderCallback::Rendered(callback_request) => callback_request,
        ProviderCallback::NotReported => return Ok(()),
        ProviderCallback::NoTemplate => {
            render_native_status_callback(sms, callback_url, status_change)
        }
    };
    let callback_result = match &operation_context.status_callback_sender {
        Some(status_callback_sender) => Some(
            status_callback_sender
                .send_status_callback(&callback_request)
                .await,
        ),
        None => None,
    };
    let (response, error_message, duration_ms) = match callback_result {
        Some(callback_result) => (
            callback_result.response,
            callback_result.error_message,
            Some(callback_result.duration_ms),
        ),
        None => (None, Some(NO_SENDER_MESSAGE.to_owned()), None),
    };
    operation_context
        .sms_repository
        .add_callback_attempt(SmsCallbackAttemptRecord {
            attempt_id: operation_context.id_generator.generate_id().to_string(),
            sms_id: sms.sms_id.clone(),
            reported_status: status_change.status.clone(),
            attempt: FIRST_ATTEMPT,
            request_json: serde_json::to_string(&callback_request).unwrap_or_default(),
            response_json: response
                .and_then(|recorded_response| serde_json::to_string(&recorded_response).ok()),
            duration_ms,
            error_message,
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        })
        .await?;
    Ok(())
}

/// SendMock's JSON callback for the native API.
fn render_native_status_callback(
    sms: &SmsRecord,
    callback_url: &str,
    status_change: &SmsStatusChangeRecord,
) -> RecordedHttpRequest {
    let callback_payload = serde_json::json!({
        "id": sms.provider_id,
        "status": status_change.status,
        "error_code": status_change.error_code,
        "from": sms.from_number,
        "to": sms.to_number,
    });
    RecordedHttpRequest {
        method: "POST".to_owned(),
        url: callback_url.to_owned(),
        headers: BTreeMap::from([
            ("Content-Type".to_owned(), "application/json".to_owned()),
            ("User-Agent".to_owned(), "SendMock".to_owned()),
        ]),
        body: serde_json::to_string_pretty(&callback_payload).unwrap_or_default(),
    }
}
