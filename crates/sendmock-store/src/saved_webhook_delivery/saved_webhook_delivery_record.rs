/// A saved delivery as stored. JSON columns are documents the operations layer owns.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SavedWebhookDeliveryRecord {
    pub saved_id: String,
    pub name: String,
    /// The endpoint it was sent to; none once that endpoint is deleted.
    pub endpoint_id: Option<String>,
    pub event_type: Option<String>,
    /// The event it carried, so a send can render it again.
    pub event_json: Option<String>,
    /// The template its endpoint used when it was saved.
    pub template_id: String,
    /// The request before signing.
    pub request_json: String,
    pub saved_at_unix_ms: i64,
}
