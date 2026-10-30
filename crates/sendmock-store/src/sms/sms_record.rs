/// One stored SMS or WhatsApp message, with its media described (not their bytes).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmsRecord {
    pub sms_id: String,
    /// The provider's id for it, such as `SM` and 32 hex digits for Twilio.
    pub provider_id: String,
    /// `outbound` (your app sent it) or `inbound` (a contact texted your app).
    pub direction: String,
    /// `sms` or `whatsapp`.
    pub channel: String,
    /// `native` or the provider's key, such as `twilio`.
    pub api: String,
    pub from_number: String,
    pub from_raw: String,
    pub to_number: String,
    pub to_raw: String,
    pub thread_id: String,
    pub app_number: String,
    pub contact_number: String,
    pub body: String,
    pub encoding: String,
    pub segments: u32,
    pub status: String,
    pub error_code: Option<String>,
    pub status_callback_url: Option<String>,
    pub messaging_service_sid: Option<String>,
    pub account: Option<String>,
    pub otp_codes: Vec<String>,
    pub links: Vec<String>,
    pub metadata_json: Option<String>,
    pub request_body_json: Option<String>,
    pub api_request_id: Option<String>,
    pub opened_at_unix_ms: Option<i64>,
    pub open_count: u64,
    pub is_read: bool,
    pub in_reply_to_sms_id: Option<String>,
    pub created_at_unix_ms: i64,
    pub updated_at_unix_ms: i64,
    pub media: Vec<SmsMediaRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmsMediaRecord {
    pub media_index: u32,
    pub content_type: String,
    pub filename: Option<String>,
    /// Where the app said to fetch it; none for inline files.
    pub source_url: Option<String>,
    pub size_bytes: u64,
}

/// A message to store, with the bytes of each media file.
#[derive(Debug, Clone)]
pub struct NewSmsRecord {
    pub sms: SmsRecord,
    pub media_contents: Vec<Vec<u8>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmsStatusChangeRecord {
    pub status: String,
    pub error_code: Option<String>,
    pub at_unix_ms: i64,
}

/// One call to a message's status callback URL; request and response are JSON documents.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmsCallbackAttemptRecord {
    pub attempt_id: String,
    pub sms_id: String,
    pub reported_status: String,
    pub attempt: u32,
    pub request_json: String,
    pub response_json: Option<String>,
    pub duration_ms: Option<u64>,
    pub error_message: Option<String>,
    pub created_at_unix_ms: i64,
}

/// Which messages to list; every field narrows the list.
#[derive(Debug, Clone, Default)]
pub struct SmsListFilter {
    /// Part of either number or of the text.
    pub search_text: Option<String>,
    pub from_number: Option<String>,
    pub to_number: Option<String>,
    pub status: Option<String>,
    pub direction: Option<String>,
    pub thread_id: Option<String>,
    /// `native` or a provider key.
    pub api: Option<String>,
    /// The provider's id for the message, such as Twilio's `SM...` SID.
    pub provider_id: Option<String>,
    pub created_after_unix_ms: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmsPage {
    pub messages: Vec<SmsRecord>,
    pub next_cursor: Option<String>,
    pub total_count: u64,
}

/// A conversation: its latest message and how many there are.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmsThreadRecord {
    pub last_message: SmsRecord,
    pub message_count: u64,
    pub unread_count: u64,
}
