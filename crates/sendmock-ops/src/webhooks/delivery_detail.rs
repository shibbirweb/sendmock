use schemars::JsonSchema;
use sendmock_store::WebhookDeliveryRecord;
use serde::Serialize;

use super::delivery_view::WebhookDelivery;
use super::endpoint_settings::RetryPolicy;
use crate::{OperationContext, OperationError};

/// One attempt of the same event, for the detail's attempt list.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct DeliveryAttemptSummary {
    pub delivery_id: String,
    pub attempt: u32,
    pub status: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<u16>")]
    pub status_code: Option<u16>,
    pub created_at: String,
}

/// The email or SMS that caused a delivery.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct DeliverySubject {
    /// `email` or `sms`.
    pub kind: String,
    pub id: String,
    /// Subject, or the SMS body.
    pub title: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub sms_thread_id: Option<String>,
}

/// `GET /api/v1/webhooks/deliveries/{deliveryId}` (WH-03.8).
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct WebhookDeliveryDetail {
    #[serde(flatten)]
    pub delivery: WebhookDelivery,
    pub max_attempts: u32,
    /// Every attempt of this event to this endpoint, oldest first.
    pub attempts: Vec<DeliveryAttemptSummary>,
    #[schemars(required, schema_with = "crate::nullable_schema::<DeliverySubject>")]
    pub subject: Option<DeliverySubject>,
}

pub async fn find_delivery_or_not_found(
    operation_context: &OperationContext,
    delivery_id: &str,
) -> Result<WebhookDeliveryRecord, OperationError> {
    operation_context
        .webhook_delivery_repository
        .find_delivery(delivery_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No webhook delivery with id {delivery_id}"),
        })
}

fn summarize_attempt(stored_attempt: WebhookDeliveryRecord) -> DeliveryAttemptSummary {
    let attempt_view = WebhookDelivery::from(stored_attempt);
    DeliveryAttemptSummary {
        delivery_id: attempt_view.id,
        attempt: attempt_view.attempt,
        status: attempt_view.status,
        status_code: attempt_view.response.map(|response| response.status_code),
        created_at: attempt_view.created_at,
    }
}

/// The email or SMS behind the delivery, when it still exists.
async fn find_delivery_subject(
    operation_context: &OperationContext,
    stored_delivery: &WebhookDeliveryRecord,
) -> Result<Option<DeliverySubject>, OperationError> {
    let Some(subject_id) = stored_delivery.subject_id.as_deref() else {
        return Ok(None);
    };
    if stored_delivery.event_type.starts_with("email.") {
        let stored_email = operation_context
            .email_repository
            .find_email(subject_id)
            .await?;
        return Ok(stored_email.map(|stored_email| DeliverySubject {
            kind: "email".to_owned(),
            id: subject_id.to_owned(),
            title: stored_email.subject,
            sms_thread_id: None,
        }));
    }
    if stored_delivery.event_type.starts_with("sms.") {
        let stored_sms = operation_context
            .sms_repository
            .find_message(subject_id)
            .await?;
        return Ok(stored_sms.map(|stored_sms| DeliverySubject {
            kind: "sms".to_owned(),
            id: subject_id.to_owned(),
            title: stored_sms.body,
            sms_thread_id: Some(stored_sms.thread_id),
        }));
    }
    Ok(None)
}

pub async fn load_delivery_detail(
    operation_context: &OperationContext,
    stored_delivery: WebhookDeliveryRecord,
) -> Result<WebhookDeliveryDetail, OperationError> {
    let max_attempts = serde_json::from_str::<RetryPolicy>(&stored_delivery.retry_policy_json)
        .map(|retry_policy| retry_policy.max_attempts)
        .unwrap_or(1);
    let attempts = operation_context
        .webhook_delivery_repository
        .list_event_attempts(&stored_delivery.event_id, &stored_delivery.endpoint_id)
        .await?
        .into_iter()
        .map(summarize_attempt)
        .collect();
    let subject = find_delivery_subject(operation_context, &stored_delivery).await?;
    Ok(WebhookDeliveryDetail {
        delivery: WebhookDelivery::from(stored_delivery),
        max_attempts,
        attempts,
        subject,
    })
}
