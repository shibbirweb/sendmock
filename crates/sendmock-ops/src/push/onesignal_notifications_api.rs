//! OneSignal's create notification API, as `@onesignal/node-onesignal` 5 calls it: `POST
//! /notifications`, answered with the notification id; errors as `{ "errors": [...] }`.

use sendmock_core::template::generate_uuid_v4;
use serde_json::{Map, Value, json};

use super::magic_push_tokens::{PushTokenFailure, read_push_token_failure};
use super::push_store::{NewPushNotification, store_push_notification};
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, answer_json};
use crate::{OperationContext, OperationError};

const NO_RECIPIENTS_MESSAGE: &str =
    "You must include which players, segments, or tags you wish to send this notification to.";
const NO_CONTENTS_MESSAGE: &str = "Notifications must have English language content";
const NOT_SUBSCRIBED_MESSAGE: &str = "All included players are not subscribed";
const RATE_LIMIT_MESSAGE: &str = "API rate limit exceeded";

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

/// One recipient: a subscription or player id, or an alias label with one of its ids. A
/// segment send is one recipient labelled `segment`.
struct OneSignalRecipient {
    alias_label: Option<String>,
    recipient_id: String,
}

impl OneSignalRecipient {
    fn read_device_token(&self) -> String {
        match &self.alias_label {
            Some(alias_label) => format!("{alias_label}:{}", self.recipient_id),
            None => self.recipient_id.clone(),
        }
    }
}

/// Every recipient: subscriptions, older player ids, aliases, or else the segments.
fn read_recipients(notification: &Value) -> Vec<OneSignalRecipient> {
    let mut recipient_ids = read_id_list(notification, "include_subscription_ids");
    recipient_ids.extend(read_id_list(notification, "include_player_ids"));
    let mut recipients: Vec<OneSignalRecipient> = recipient_ids
        .into_iter()
        .map(|recipient_id| OneSignalRecipient {
            alias_label: None,
            recipient_id,
        })
        .collect();
    if let Some(aliases) = notification["include_aliases"].as_object() {
        for (alias_label, alias_ids) in aliases {
            let alias_ids = alias_ids.as_array().map(Vec::as_slice).unwrap_or_default();
            recipients.extend(alias_ids.iter().filter_map(Value::as_str).map(|alias_id| {
                OneSignalRecipient {
                    alias_label: Some(alias_label.clone()),
                    recipient_id: alias_id.to_owned(),
                }
            }));
        }
    }
    let segments = read_id_list(notification, "included_segments");
    if recipients.is_empty() && !segments.is_empty() {
        recipients.push(OneSignalRecipient {
            alias_label: Some("segment".to_owned()),
            recipient_id: segments.join(","),
        });
    }
    recipients
}

/// The refused recipients as OneSignal lists them: `invalid_player_ids`, and
/// `invalid_aliases` by label.
fn build_invalid_recipients(refused_recipients: &[&OneSignalRecipient]) -> Value {
    let mut invalid_player_ids = Vec::new();
    let mut invalid_aliases = Map::new();
    for refused_recipient in refused_recipients {
        match &refused_recipient.alias_label {
            Some(alias_label) => {
                let alias_entry = invalid_aliases
                    .entry(alias_label.clone())
                    .or_insert_with(|| json!([]));
                if let Some(alias_ids) = alias_entry.as_array_mut() {
                    alias_ids.push(json!(refused_recipient.recipient_id));
                }
            }
            None => invalid_player_ids.push(json!(refused_recipient.recipient_id)),
        }
    }
    let mut invalid_recipients = Map::new();
    if !invalid_player_ids.is_empty() {
        invalid_recipients.insert("invalid_player_ids".to_owned(), json!(invalid_player_ids));
    }
    if !invalid_aliases.is_empty() {
        invalid_recipients.insert("invalid_aliases".to_owned(), Value::Object(invalid_aliases));
    }
    Value::Object(invalid_recipients)
}

fn is_refused(recipient: &OneSignalRecipient) -> bool {
    matches!(
        read_push_token_failure(&recipient.recipient_id),
        Some(PushTokenFailure::Unregistered | PushTokenFailure::Invalid)
    )
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
    let response = answer_recipients(operation_context, &notification, &recipients).await?;
    Ok(Some(response))
}

/// What OneSignal answers the recipients, each stored as sent or refused: a `throttled` one
/// rate-limits the request, `unregistered` and `invalid` ones are listed under `errors`.
async fn answer_recipients(
    operation_context: &OperationContext,
    notification: &Value,
    recipients: &[OneSignalRecipient],
) -> Result<ProviderHttpResponse, OperationError> {
    let is_throttled = recipients.iter().any(|recipient| {
        read_push_token_failure(&recipient.recipient_id) == Some(PushTokenFailure::Throttled)
    });
    if is_throttled {
        let response = json!({ "errors": [RATE_LIMIT_MESSAGE] });
        let stored_answer = (429, response.clone(), String::new());
        store_recipients(
            operation_context,
            notification,
            recipients,
            &stored_answer,
            |_| Some(RATE_LIMIT_MESSAGE.to_owned()),
        )
        .await?;
        return Ok(answer_json(429, response));
    }
    let refused_recipients: Vec<&OneSignalRecipient> = recipients
        .iter()
        .filter(|recipient| is_refused(recipient))
        .collect();
    let response = if refused_recipients.len() == recipients.len() {
        json!({ "id": "", "errors": [NOT_SUBSCRIBED_MESSAGE] })
    } else {
        let mut accepted = json!({
            "id": generate_uuid_v4(operation_context.random_source.as_ref()),
            "external_id": notification["external_id"].clone(),
        });
        if !refused_recipients.is_empty() {
            accepted["errors"] = build_invalid_recipients(&refused_recipients);
        }
        accepted
    };
    let notification_id = response["id"].as_str().unwrap_or_default().to_owned();
    let stored_answer = (200, response.clone(), notification_id);
    store_recipients(
        operation_context,
        notification,
        recipients,
        &stored_answer,
        |recipient| {
            is_refused(recipient).then(|| match recipient.alias_label {
                Some(_) => "invalid_aliases".to_owned(),
                None => "invalid_player_ids".to_owned(),
            })
        },
    )
    .await?;
    Ok(answer_json(200, response))
}

/// Stores a notification per recipient with the answer (status, body, notification id) and
/// the reason each recipient was refused, if it was.
async fn store_recipients(
    operation_context: &OperationContext,
    notification: &Value,
    recipients: &[OneSignalRecipient],
    (response_status, response, notification_id): &(u16, Value, String),
    read_refusal: impl Fn(&OneSignalRecipient) -> Option<String>,
) -> Result<(), OperationError> {
    for recipient in recipients {
        let error_reason = read_refusal(recipient);
        let onesignal_notification = NewPushNotification {
            provider_message_id: if error_reason.is_some() {
                String::new()
            } else {
                notification_id.clone()
            },
            device_token: recipient.read_device_token(),
            error_reason,
            response_status: *response_status,
            response: response.clone(),
            ..build_onesignal_notification(notification)
        };
        store_push_notification(operation_context, onesignal_notification).await?;
    }
    Ok(())
}
