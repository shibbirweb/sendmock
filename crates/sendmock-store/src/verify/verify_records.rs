#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerifyServiceRecord {
    /// `VA` and 32 hex digits.
    pub service_sid: String,
    pub friendly_name: String,
    pub code_length: u32,
    pub fixed_code: Option<String>,
    pub ttl_seconds: u32,
    pub created_by: String,
    pub created_at_unix_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerificationRecord {
    /// `VE` and 32 hex digits.
    pub verification_sid: String,
    pub service_sid: String,
    pub service_name: String,
    pub account_sid: Option<String>,
    pub to_address: String,
    /// `sms`, `whatsapp`, `email` or `call`.
    pub channel: String,
    pub code: String,
    /// `pending`, `approved`, `canceled`, `expired` or `max_attempts_reached`.
    pub status: String,
    pub check_attempts: u32,
    pub send_attempts: u32,
    pub expires_at_unix_ms: i64,
    pub linked_message_id: Option<String>,
    pub linked_thread_id: Option<String>,
    pub created_at_unix_ms: i64,
    pub updated_at_unix_ms: i64,
}

/// One step of a verification: `started`, `code_sent`, `check_failed`, `approved`, ...
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerificationTimelineRecord {
    pub kind: String,
    pub at_unix_ms: i64,
    pub detail: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct VerificationFilter {
    pub statuses: Vec<String>,
    /// Part of the recipient.
    pub to_text: Option<String>,
    pub channel: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerificationPage {
    pub verifications: Vec<VerificationRecord>,
    pub next_cursor: Option<String>,
    pub total_count: u64,
}
