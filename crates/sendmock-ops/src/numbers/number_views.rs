use schemars::JsonSchema;
use sendmock_store::{MessagingServiceRecord, VirtualNumberRecord};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct VirtualNumber {
    pub id: String,
    pub number: String,
    pub label: String,
    pub channels: Vec<String>,
    #[schemars(required)]
    pub inbound_url: Option<String>,
    pub inbound_method: String,
    #[schemars(required)]
    pub inbound_fallback_url: Option<String>,
    #[schemars(required)]
    pub inbound_template_id: Option<String>,
    #[schemars(required)]
    pub status_callback_url: Option<String>,
    #[schemars(required)]
    pub messaging_service_sid: Option<String>,
    pub created_by: String,
}

impl From<VirtualNumberRecord> for VirtualNumber {
    fn from(stored_number: VirtualNumberRecord) -> Self {
        Self {
            id: stored_number.number_id,
            number: stored_number.number,
            label: stored_number.label,
            channels: stored_number.channels,
            inbound_url: stored_number.inbound_url,
            inbound_method: stored_number.inbound_method,
            inbound_fallback_url: stored_number.inbound_fallback_url,
            inbound_template_id: stored_number.inbound_template_id,
            status_callback_url: stored_number.status_callback_url,
            messaging_service_sid: stored_number.messaging_service_sid,
            created_by: stored_number.created_by,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct MessagingService {
    pub sid: String,
    pub friendly_name: String,
    pub number_ids: Vec<String>,
    pub inbound_mode: String,
    #[schemars(required)]
    pub inbound_url: Option<String>,
    #[schemars(required)]
    pub inbound_fallback_url: Option<String>,
    pub created_by: String,
}

impl From<MessagingServiceRecord> for MessagingService {
    fn from(stored_service: MessagingServiceRecord) -> Self {
        Self {
            sid: stored_service.service_sid,
            friendly_name: stored_service.friendly_name,
            number_ids: stored_service.number_ids,
            inbound_mode: stored_service.inbound_mode,
            inbound_url: stored_service.inbound_url,
            inbound_fallback_url: stored_service.inbound_fallback_url,
            created_by: stored_service.created_by,
        }
    }
}
