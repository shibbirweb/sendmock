//! FCM HTTP v1's send API, as `firebase-admin` 14 calls it: `POST
//! /v1/projects/{project_id}/messages:send` with `{ message, validate_only? }`, answered with the
//! message name; errors in Google's shape with an `FcmError` detail, which the SDK maps.

use serde_json::{Value, json};

use super::magic_push_tokens::{PushTokenFailure, read_push_token_failure};
use super::push_store::{NewPushNotification, store_push_notification};
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, answer_json};
use crate::{OperationContext, OperationError};

const FCM_ERROR_TYPE: &str = "type.googleapis.com/google.firebase.fcm.v1.FcmError";

/// Google's error shape; `firebase-admin` maps the `FcmError` detail's `errorCode` to its own
/// `messaging/...` code.
fn build_fcm_error(status: u16, status_name: &str, error_code: &str, message: &str) -> Value {
    json!({
        "error": {
            "code": status,
            "message": message,
            "status": status_name,
            "details": [{ "@type": FCM_ERROR_TYPE, "errorCode": error_code }],
        }
    })
}

/// What FCM answers a magic token: its status, status name, `FcmError` code and message.
fn describe_token_failure(
    token_failure: PushTokenFailure,
) -> (u16, &'static str, &'static str, &'static str) {
    match token_failure {
        PushTokenFailure::Unregistered => (
            404,
            "NOT_FOUND",
            "UNREGISTERED",
            "Requested entity was not found.",
        ),
        PushTokenFailure::Invalid => (
            400,
            "INVALID_ARGUMENT",
            "INVALID_ARGUMENT",
            "The registration token is not a valid FCM registration token",
        ),
        PushTokenFailure::Throttled => (
            429,
            "RESOURCE_EXHAUSTED",
            "QUOTA_EXCEEDED",
            "Quota exceeded for sending messages to this device.",
        ),
    }
}

/// The project id of a send path, or `None` for any other path.
fn read_project_id(request: &ProviderHttpRequest) -> Option<&str> {
    let project_and_action = request.path.strip_prefix("/v1/projects/")?;
    let (project_id, rest_of_path) = project_and_action.split_once("/messages:send")?;
    (request.method == "POST" && rest_of_path.is_empty() && !project_id.contains('/'))
        .then_some(project_id)
}

/// The first text found at any of the pointers: the cross-platform notification, then each
/// platform's own.
fn read_first_text(message: &Value, pointers: &[&str]) -> Option<String> {
    pointers
        .iter()
        .find_map(|pointer| message.pointer(pointer).and_then(Value::as_str))
        .map(str::to_owned)
}

/// Where the message goes: a registration token, or a topic or condition, shown as such.
fn read_target(message: &Value) -> Option<String> {
    if let Some(token) = message["token"].as_str() {
        return Some(token.to_owned());
    }
    ["topic", "condition"].iter().find_map(|target_kind| {
        message[*target_kind]
            .as_str()
            .map(|target| format!("{target_kind}:{target}"))
    })
}

fn read_platform(message: &Value) -> Option<String> {
    [("android", "android"), ("apns", "ios"), ("webpush", "web")]
        .iter()
        .find(|(config_key, _)| message.get(*config_key).is_some())
        .map(|(_, platform)| (*platform).to_owned())
}

/// What the message shows and carries: the cross-platform notification first, then each
/// platform's own.
fn read_fcm_notification(message: &Value) -> NewPushNotification {
    NewPushNotification {
        provider: "fcm",
        platform: read_platform(message),
        title: read_first_text(
            message,
            &[
                "/notification/title",
                "/android/notification/title",
                "/apns/payload/aps/alert/title",
                "/webpush/notification/title",
            ],
        ),
        body: read_first_text(
            message,
            &[
                "/notification/body",
                "/android/notification/body",
                "/apns/payload/aps/alert/body",
                "/webpush/notification/body",
            ],
        ),
        image_url: read_first_text(
            message,
            &[
                "/notification/image",
                "/android/notification/image",
                "/apns/fcm_options/image",
                "/webpush/notification/image",
            ],
        ),
        data: message.get("data").cloned().unwrap_or_else(|| json!({})),
        response_status: 200,
        ..NewPushNotification::default()
    }
}

/// Stores the send as failed and answers FCM's error for the magic token.
async fn refuse_magic_token(
    operation_context: &OperationContext,
    request_body: &Value,
    device_token: String,
    token_failure: PushTokenFailure,
) -> Result<ProviderHttpResponse, OperationError> {
    let (status, status_name, error_code, error_message) = describe_token_failure(token_failure);
    let response = build_fcm_error(status, status_name, error_code, error_message);
    let failed_notification = NewPushNotification {
        device_token,
        error_reason: Some(error_code.to_owned()),
        request: request_body.clone(),
        response_status: status,
        response: response.clone(),
        ..read_fcm_notification(&request_body["message"])
    };
    store_push_notification(operation_context, failed_notification).await?;
    Ok(answer_json(status, response))
}

/// Answers an FCM send, or `None` when the request is not one.
pub async fn answer_fcm_send(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderHttpResponse>, OperationError> {
    let Some(project_id) = read_project_id(request) else {
        return Ok(None);
    };
    let request_body: Value = serde_json::from_slice(&request.body).unwrap_or(Value::Null);
    let message = &request_body["message"];
    let Some(device_token) = read_target(message) else {
        let refusal = build_fcm_error(
            400,
            "INVALID_ARGUMENT",
            "INVALID_ARGUMENT",
            "Recipient of the message is not set.",
        );
        return Ok(Some(answer_json(400, refusal)));
    };
    if request_body["validate_only"].as_bool() == Some(true) {
        let dry_run_name = format!("projects/{project_id}/messages/fake_message_id");
        return Ok(Some(answer_json(200, json!({ "name": dry_run_name }))));
    }
    if let Some(token_failure) = read_push_token_failure(&device_token) {
        let refusal = refuse_magic_token(
            operation_context,
            &request_body,
            device_token,
            token_failure,
        )
        .await?;
        return Ok(Some(refusal));
    }
    let message_name = format!(
        "projects/{project_id}/messages/0:{}%{:016x}",
        operation_context.clock.now_unix_ms() * 1000,
        operation_context.random_source.next_u64()
    );
    let response = json!({ "name": message_name });
    let fcm_notification = NewPushNotification {
        provider_message_id: message_name,
        device_token,
        request: request_body.clone(),
        response: response.clone(),
        ..read_fcm_notification(message)
    };
    store_push_notification(operation_context, fcm_notification).await?;
    Ok(Some(answer_json(200, response)))
}
