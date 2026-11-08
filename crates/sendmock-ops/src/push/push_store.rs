use sendmock_store::PushNotificationRecord;
use serde_json::{Value, json};

use crate::events::publish_event;
use crate::{AppEventType, OperationContext, OperationError};

/// What an adapter read from a provider request and answered.
#[derive(Debug, Clone, Default)]
pub struct NewPushNotification {
    pub provider: &'static str,
    pub provider_message_id: String,
    pub device_token: String,
    pub platform: Option<String>,
    pub title: Option<String>,
    pub body: Option<String>,
    pub image_url: Option<String>,
    pub data: Value,
    pub error_reason: Option<String>,
    pub request: Value,
    pub response_status: u16,
    pub response: Value,
}

/// Stores a notification in the request's project; failed when the provider refused it.
pub async fn store_push_notification(
    operation_context: &OperationContext,
    new_notification: NewPushNotification,
) -> Result<PushNotificationRecord, OperationError> {
    let push_record = PushNotificationRecord {
        push_id: operation_context.id_generator.generate_id().to_string(),
        provider: new_notification.provider.to_owned(),
        provider_message_id: new_notification.provider_message_id,
        device_token: new_notification.device_token,
        platform: new_notification.platform,
        title: new_notification.title,
        body: new_notification.body,
        image_url: new_notification.image_url,
        data_json: new_notification.data.to_string(),
        status: if new_notification.error_reason.is_some() {
            "failed"
        } else {
            "sent"
        }
        .to_owned(),
        error_reason: new_notification.error_reason,
        request_json: new_notification.request.to_string(),
        response_status: new_notification.response_status,
        response_json: new_notification.response.to_string(),
        project_key: operation_context.request.project_key.clone(),
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
    };
    operation_context
        .push_notifications
        .insert_notification(push_record.clone())
        .await?;
    publish_push_event(operation_context, &push_record);
    Ok(push_record)
}

/// `push.sent`, or `push.failed` when the provider refused it, naming the notification.
fn publish_push_event(operation_context: &OperationContext, push_record: &PushNotificationRecord) {
    let event_type = if push_record.status == "failed" {
        AppEventType::PushFailed
    } else {
        AppEventType::PushSent
    };
    publish_event(
        operation_context,
        event_type,
        json!({
            "id": push_record.push_id,
            "provider": push_record.provider,
            "device_token": push_record.device_token,
            "title": push_record.title,
            "status": push_record.status,
            "error_reason": push_record.error_reason,
            "project": push_record.project_key,
        }),
    );
}
