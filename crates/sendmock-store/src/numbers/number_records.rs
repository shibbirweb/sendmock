/// A virtual number as stored; `channels` holds `sms` and or `whatsapp`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VirtualNumberRecord {
    pub number_id: String,
    /// E.164, unique.
    pub number: String,
    pub label: String,
    pub channels: Vec<String>,
    pub inbound_url: Option<String>,
    /// `POST` or `GET`.
    pub inbound_method: String,
    pub inbound_fallback_url: Option<String>,
    pub inbound_template_id: Option<String>,
    pub status_callback_url: Option<String>,
    pub messaging_service_sid: Option<String>,
    pub created_by: String,
    pub created_at_unix_ms: i64,
}

/// A Messaging Service with the ids of the numbers in its sender pool, oldest first.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessagingServiceRecord {
    pub service_sid: String,
    pub friendly_name: String,
    pub number_ids: Vec<String>,
    /// `webhook`, `defer_to_sender` or `drop`.
    pub inbound_mode: String,
    pub inbound_url: Option<String>,
    pub inbound_fallback_url: Option<String>,
    pub created_by: String,
    pub created_at_unix_ms: i64,
}
