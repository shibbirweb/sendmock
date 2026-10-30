use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::SavedWebhookDeliveryRecord;
use serde::Serialize;

use super::delivery_replay_operation::parse_json;
use crate::{OperationError, RecordedHttpRequest};

/// A saved delivery as the Saved screen lists it (WH-10.4).
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SavedDelivery {
    pub id: String,
    pub name: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub endpoint_id: Option<String>,
    /// The event of the delivery it was saved from.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub event_type: Option<String>,
    pub template_id: String,
    /// The stored request, without signature headers; they are made fresh on every send.
    pub request: RecordedHttpRequest,
    pub saved_at: String,
}

pub(super) fn build_saved_delivery_view(
    saved_delivery: SavedWebhookDeliveryRecord,
) -> Result<SavedDelivery, OperationError> {
    Ok(SavedDelivery {
        request: parse_json(&saved_delivery.request_json)?,
        id: saved_delivery.saved_id,
        name: saved_delivery.name,
        endpoint_id: saved_delivery.endpoint_id,
        event_type: saved_delivery.event_type,
        template_id: saved_delivery.template_id,
        saved_at: format_rfc3339(saved_delivery.saved_at_unix_ms),
    })
}
