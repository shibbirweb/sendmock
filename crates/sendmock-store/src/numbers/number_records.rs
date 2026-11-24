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
    /// `PN` and 32 hex digits, as Twilio's IncomingPhoneNumbers API names the number.
    pub phone_number_sid: String,
    /// The Twilio account the number belongs to; `None` for the main account.
    pub account_sid: Option<String>,
    /// Whether texts of STOP to it opt the contact out, with the provider's emulation on.
    pub opt_out_keywords: bool,
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
    /// Whether texts of STOP to its numbers opt the contact out of the whole service.
    pub opt_out_keywords: bool,
    /// The Twilio subaccount that owns the service; `None` for the main account.
    pub account_sid: Option<String>,
    pub created_by: String,
    pub created_at_unix_ms: i64,
}
