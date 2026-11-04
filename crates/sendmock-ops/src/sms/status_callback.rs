use std::collections::BTreeMap;

use sendmock_store::{SmsCallbackAttemptRecord, SmsRecord, SmsStatusChangeRecord};

use super::sms_views::RecordedHttpRequest;
use super::status_callback_attempt::send_callback_attempt;
use crate::providers::{ProviderCallback, render_provider_status_callback};
use crate::{OperationContext, OperationError};

/// Calls the message's status callback URL for one status change, in its provider's format
/// (SendMock's JSON for the native API). The attempt is stored before it is sent, so a restart
/// sends it again, and a failed attempt is retried from the queue with the same request. Does
/// nothing for a message without a callback URL, or a status its provider does not report.
pub async fn send_status_callback(
    operation_context: &OperationContext,
    sms: &SmsRecord,
    status_change: &SmsStatusChangeRecord,
) -> Result<(), OperationError> {
    let Some(callback_url) = sms.status_callback_url.as_deref() else {
        return Ok(());
    };
    let callback_request =
        match render_provider_status_callback(operation_context, sms, callback_url, status_change)
            .await?
        {
            ProviderCallback::Rendered(callback_request) => callback_request,
            ProviderCallback::NotReported => return Ok(()),
            ProviderCallback::NoTemplate => {
                render_native_status_callback(sms, callback_url, status_change)
            }
        };
    let first_attempt = SmsCallbackAttemptRecord {
        attempt_id: operation_context.id_generator.generate_id().to_string(),
        sms_id: sms.sms_id.clone(),
        reported_status: status_change.status.clone(),
        attempt: 1,
        status: "in_flight".to_owned(),
        request_json: serde_json::to_string(&callback_request)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?,
        response_json: None,
        duration_ms: None,
        error_message: None,
        next_attempt_at_unix_ms: None,
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
    };
    operation_context
        .sms_callback_attempt_repository
        .insert_attempt(first_attempt.clone())
        .await?;
    send_callback_attempt(operation_context, &first_attempt).await
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
