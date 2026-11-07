//! OneSignal's create notification API, as `@onesignal/node-onesignal` 5 calls it: `POST
//! /notifications`, answered with the notification id; errors as `{ "errors": [...] }`.

use sendmock_core::template::generate_uuid_v4;
use serde_json::{Value, json};

use super::push_store::{NewPushNotification, store_push_notification};
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, answer_json};
use crate::{OperationContext, OperationError};

const NO_RECIPIENTS_MESSAGE: &str =
    "You must include which players, segments, or tags you wish to send this notification to.";
const NO_CONTENTS_MESSAGE: &str = "Notifications must have English language content";

fn answer_onesignal_error(message: &str) -> ProviderHttpResponse {
    answer_json(400, json!({ "errors": [message] }))
}

/// The ids of a list field, such as `include_subscription_ids`.
fn read_id_list(notification: &Value, field_name: &str) -> Vec<String> {
    notification[field_name]
        .as_array()
        .map(|ids| {
            ids.iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

/// Every recipient: subscriptions, older player ids, aliases as `<label>:<id>`, or the
/// segments as one `segment:<names>` target.
fn read_recipients(notification: &Value) -> Vec<String> {
    let mut recipients = read_id_list(notification, "include_subscription_ids");
    recipients.extend(read_id_list(notification, "include_player_ids"));
    if let Some(aliases) = notification["include_aliases"].as_object() {
        for (alias_label, alias_ids) in aliases {
            let alias_ids = alias_ids.as_array().map(Vec::as_slice).unwrap_or_default();
            recipients.extend(
                alias_ids
                    .iter()
                    .filter_map(Value::as_str)
                    .map(|alias_id| format!("{alias_label}:{alias_id}")),
            );
        }
    }
    let segments = read_id_list(notification, "included_segments");
    if recipients.is_empty() && !segments.is_empty() {
        recipients.push(format!("segment:{}", segments.join(",")));
    }
    recipients
}

/// The text of a language map: English first, else the first language given.
fn read_language_text(notification: &Value, field_name: &str) -> Option<String> {
    let language_map = notification[field_name].as_object()?;
    language_map
        .get("en")
        .or_else(|| language_map.values().next())
        .and_then(Value::as_str)
        .map(str::to_owned)
}

fn read_image_url(notification: &Value) -> Option<String> {
    let ios_attachment = notification["ios_attachments"]
        .as_object()
        .and_then(|attachments| attachments.values().next())
        .and_then(Value::as_str);
    notification["big_picture"]
        .as_str()
        .or(ios_attachment)
        .or_else(|| notification["chrome_web_image"].as_str())
        .map(str::to_owned)
}

/// The platform when the notification targets only one.
fn read_platform(notification: &Value) -> Option<String> {
    let platform_flags = [
        ("is_android", "android"),
        ("is_ios", "ios"),
        ("is_any_web", "web"),
    ];
    let targeted_platforms: Vec<&str> = platform_flags
        .iter()
        .filter(|(flag_name, _)| notification[*flag_name].as_bool() == Some(true))
        .map(|(_, platform)| *platform)
        .collect();
    match targeted_platforms.as_slice() {
        [only_platform] => Some((*only_platform).to_owned()),
        _ => None,
    }
}

fn build_onesignal_notification(notification: &Value) -> NewPushNotification {
    NewPushNotification {
        provider: "onesignal",
        platform: read_platform(notification),
        title: read_language_text(notification, "headings"),
        body: read_language_text(notification, "contents"),
        image_url: read_image_url(notification),
        data: notification
            .get("data")
            .cloned()
            .unwrap_or_else(|| json!({})),
        request: notification.clone(),
        response_status: 200,
        ..NewPushNotification::default()
    }
}

/// Answers a OneSignal create notification, or `None` when the request is not one.
pub async fn answer_onesignal_notification(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderHttpResponse>, OperationError> {
    if request.method != "POST" || request.path != "/notifications" {
        return Ok(None);
    }
    let notification: Value = serde_json::from_slice(&request.body).unwrap_or(Value::Null);
    let recipients = read_recipients(&notification);
    if recipients.is_empty() {
        return Ok(Some(answer_onesignal_error(NO_RECIPIENTS_MESSAGE)));
    }
    let has_contents = read_language_text(&notification, "contents").is_some();
    if !has_contents && notification["template_id"].is_null() {
        return Ok(Some(answer_onesignal_error(NO_CONTENTS_MESSAGE)));
    }
    let notification_id = generate_uuid_v4(operation_context.random_source.as_ref());
    let response = json!({
        "id": notification_id,
        "external_id": notification["external_id"].clone(),
    });
    for recipient in recipients {
        let onesignal_notification = NewPushNotification {
            provider_message_id: notification_id.clone(),
            device_token: recipient,
            response: response.clone(),
            ..build_onesignal_notification(&notification)
        };
        store_push_notification(operation_context, onesignal_notification).await?;
    }
    Ok(Some(answer_json(200, response)))
}
