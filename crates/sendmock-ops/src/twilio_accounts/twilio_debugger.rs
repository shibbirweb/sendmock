use sendmock_core::format_rfc3339;
use sendmock_store::{SmsCallbackAttemptRecord, SmsRecord};
use serde_json::{Map, Value, json};

use super::twilio_account_directory::{TWILIO_PROVIDER_KEY, TwilioAccountDirectory};
use super::twilio_signing_vars::find_conversation_account;
use crate::providers::{
    ProviderWebhookTarget, build_callback_template_functions, find_builtin_webhook_template,
    render_provider_webhook_request,
};
use crate::sms::{RecordedHttpRequest, RecordedHttpResponse, send_callback_attempt};
use crate::{OperationContext, OperationError};

const DEBUGGER_TEMPLATE_ID: &str = "twilio.debugger";
/// Debugger events are stored with the message's callback attempts under this name, so they
/// show on its timeline and are retried like status callbacks.
pub const DEBUGGER_REPORTED_STATUS: &str = "debugger";
/// Twilio's error for a webhook your app answered with an error or did not answer.
pub const WEBHOOK_FAILED_ERROR_CODE: &str = "11200";

/// Why a Debugger event is sent.
pub enum DebuggerProblem<'call> {
    /// The message ended `failed` or `undelivered` with this error code.
    FailedMessage { error_code: &'call str },
    /// A status callback or the inbound URL failed: Twilio's error 11200, with the request and
    /// the answer, if any.
    FailedWebhook {
        request: &'call RecordedHttpRequest,
        response: Option<&'call RecordedHttpResponse>,
    },
}

/// Sends one Twilio Debugger event for the message to its account's Debugger webhook URL, if
/// one is set, signed with that account's token. It is stored as a callback attempt before it
/// is sent, so it shows on the message's timeline and failures are retried.
pub async fn send_debugger_event(
    operation_context: &OperationContext,
    sms: &SmsRecord,
    problem: DebuggerProblem<'_>,
) -> Result<(), OperationError> {
    let directory = TwilioAccountDirectory::load(operation_context).await?;
    let account_sid = match sms.direction.as_str() {
        "inbound" => find_conversation_account(operation_context, sms).await?,
        _ => sms.account.clone(),
    };
    let account = directory.account_for(account_sid.as_deref());
    let Some(debugger_url) = account.debugger_url.clone() else {
        return Ok(());
    };
    let Some(debugger_template) = find_builtin_webhook_template(DEBUGGER_TEMPLATE_ID) else {
        return Ok(());
    };
    let error_code = match &problem {
        DebuggerProblem::FailedMessage { error_code } => (*error_code).to_owned(),
        DebuggerProblem::FailedWebhook { .. } => WEBHOOK_FAILED_ERROR_CODE.to_owned(),
    };
    let random_source = &operation_context.random_source;
    let event_data = json!({
        "provider_id": sms.provider_id,
        "messaging_service_sid": sms.messaging_service_sid,
        "error_code": error_code,
        "account": account.account_sid,
        "parent_account_sid": (!account.is_main).then(|| directory.main_account.account_sid.clone()),
        "debugger_sid": format!("NO{:016x}{:016x}", random_source.next_u64(), random_source.next_u64()),
        "debugger_payload": describe_payload(sms, &error_code, &problem).to_string(),
    });
    let mut template_context = json!({
        "event": {
            "type": "twilio.debugger",
            "created_at": format_rfc3339(operation_context.clock.now_unix_ms()),
        },
        "data": event_data,
        "vars": {
            "twilio_account_sid": account.account_sid,
            "twilio_auth_token": account.auth_token,
        },
        "endpoint": { "url": debugger_url },
    });
    let debugger_request = render_provider_webhook_request(
        &debugger_template,
        &ProviderWebhookTarget::to_url(&debugger_url),
        &mut template_context,
        &build_callback_template_functions(operation_context),
    );
    store_and_send(operation_context, sms, &debugger_request).await
}

/// The Debugger's `Payload`: the message, the error with its documentation link and, for a
/// failed webhook, the request and the answer.
fn describe_payload(sms: &SmsRecord, error_code: &str, problem: &DebuggerProblem<'_>) -> Value {
    let mut payload = json!({
        "resource_sid": sms.provider_id,
        "service_sid": sms.messaging_service_sid,
        "error_code": error_code,
        "more_info": {
            "Msg": match problem {
                DebuggerProblem::FailedMessage { .. } => "Message delivery failed",
                DebuggerProblem::FailedWebhook { .. } => "HTTP request to your webhook failed",
            },
            "ErrorCode": error_code,
            "LogLevel": "ERROR",
            "Url": format!("https://www.twilio.com/docs/errors/{error_code}"),
        },
    });
    if let DebuggerProblem::FailedWebhook { request, response } = problem {
        payload["webhook"] = json!({
            "type": "application/x-www-form-urlencoded",
            "request": {
                "url": request.url,
                "method": request.method,
                "headers": request.headers,
                "parameters": read_form_parameters(&request.body),
            },
            "response": response.map(|answer| json!({
                "status_code": answer.status_code,
                "headers": answer.headers,
                "body": answer.body,
            })),
        });
    }
    payload
}

fn read_form_parameters(form_body: &str) -> Value {
    let pairs: Vec<(String, String)> = serde_urlencoded::from_str(form_body).unwrap_or_default();
    Value::Object(
        pairs
            .into_iter()
            .map(|(name, value)| (name, Value::from(value)))
            .collect::<Map<_, _>>(),
    )
}

async fn store_and_send(
    operation_context: &OperationContext,
    sms: &SmsRecord,
    debugger_request: &RecordedHttpRequest,
) -> Result<(), OperationError> {
    let first_attempt = SmsCallbackAttemptRecord {
        attempt_id: operation_context.id_generator.generate_id().to_string(),
        sms_id: sms.sms_id.clone(),
        reported_status: DEBUGGER_REPORTED_STATUS.to_owned(),
        attempt: 1,
        status: "in_flight".to_owned(),
        request_json: serde_json::to_string(debugger_request)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?,
        response_json: None,
        duration_ms: None,
        error_message: None,
        next_attempt_at_unix_ms: None,
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
    };
    operation_context
        .sms_delivery_stores
        .callback_attempts
        .insert_attempt(first_attempt.clone())
        .await?;
    send_callback_attempt(operation_context, &first_attempt).await
}

/// A Twilio message that ended `failed` or `undelivered` with an error code sends one Debugger
/// event, as Twilio's Console does.
pub async fn report_failed_message(
    operation_context: &OperationContext,
    sms: &SmsRecord,
    status: &str,
    error_code: Option<&str>,
) -> Result<(), OperationError> {
    let is_failure = matches!(status, "failed" | "undelivered");
    match error_code {
        Some(error_code) if is_failure && sms.api == TWILIO_PROVIDER_KEY => {
            send_debugger_event(
                operation_context,
                sms,
                DebuggerProblem::FailedMessage { error_code },
            )
            .await
        }
        _ => Ok(()),
    }
}

/// A reply webhook (the inbound URL) that failed sends one Debugger event with error 11200,
/// the request and the status it answered, if any.
pub async fn report_failed_inbound_webhook(
    operation_context: &OperationContext,
    inbound_sms: &SmsRecord,
    webhook_request: &RecordedHttpRequest,
    answered_status_code: Option<u16>,
) -> Result<(), OperationError> {
    let answered_response = answered_status_code.map(|status_code| RecordedHttpResponse {
        status_code,
        headers: std::collections::BTreeMap::new(),
        body: String::new(),
        is_body_truncated: false,
    });
    send_debugger_event(
        operation_context,
        inbound_sms,
        DebuggerProblem::FailedWebhook {
            request: webhook_request,
            response: answered_response.as_ref(),
        },
    )
    .await
}
