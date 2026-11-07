use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::WebhookDeliveryRecord;
use serde::Serialize;

use crate::{RecordedHttpRequest, RecordedHttpResponse};

/// One attempt as the deliveries log shows it.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct WebhookDelivery {
    pub id: String,
    pub endpoint_id: String,
    pub endpoint_name: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub rule_id: Option<String>,
    pub event_id: String,
    pub event_type: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub subject_id: Option<String>,
    /// `auto`, `manual` or `replay`.
    pub trigger: String,
    pub attempt: u32,
    pub status: String,
    /// The request as sent, signature headers included; null until the attempt runs.
    #[schemars(
        required,
        schema_with = "crate::nullable_schema::<RecordedHttpRequest>"
    )]
    pub request: Option<RecordedHttpRequest>,
    #[schemars(
        required,
        schema_with = "crate::nullable_schema::<RecordedHttpResponse>"
    )]
    pub response: Option<RecordedHttpResponse>,
    #[schemars(required, schema_with = "crate::nullable_schema::<u32>")]
    pub duration_ms: Option<u32>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub error_message: Option<String>,
    /// When the next attempt runs; null when none is scheduled.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub next_attempt_at: Option<String>,
    pub created_at: String,
}

impl From<WebhookDeliveryRecord> for WebhookDelivery {
    fn from(stored_delivery: WebhookDeliveryRecord) -> Self {
        let is_scheduled =
            stored_delivery.status == "failed" || stored_delivery.status == "pending";
        Self {
            id: stored_delivery.delivery_id,
            endpoint_id: stored_delivery.endpoint_id,
            endpoint_name: stored_delivery.endpoint_name,
            rule_id: stored_delivery.rule_id,
            event_id: stored_delivery.event_id,
            event_type: stored_delivery.event_type,
            subject_id: stored_delivery.subject_id,
            trigger: stored_delivery.trigger,
            attempt: stored_delivery.attempt,
            status: stored_delivery.status,
            request: stored_delivery
                .sent_request_json
                .and_then(|request_json| serde_json::from_str(&request_json).ok()),
            response: stored_delivery
                .response_json
                .and_then(|response_json| serde_json::from_str(&response_json).ok()),
            duration_ms: stored_delivery.duration_ms,
            error_message: stored_delivery.error_message,
            next_attempt_at: stored_delivery
                .next_attempt_at_unix_ms
                .filter(|_| is_scheduled)
                .map(format_rfc3339),
            created_at: format_rfc3339(stored_delivery.created_at_unix_ms),
        }
    }
}
