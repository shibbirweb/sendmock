use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// A name and address as stored; `name` is empty when the message gave none.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct StoredEmailAddress {
    pub name: String,
    pub address: String,
}

/// An email as stored, without its raw message or attachment bytes.
#[derive(Debug, Clone, PartialEq)]
pub struct EmailRecord {
    pub email_id: String,
    pub received_at_unix_ms: i64,
    pub message_id: Option<String>,
    pub subject: String,
    pub from: StoredEmailAddress,
    pub to: Vec<StoredEmailAddress>,
    pub cc: Vec<StoredEmailAddress>,
    pub bcc: Vec<StoredEmailAddress>,
    pub reply_to: Vec<StoredEmailAddress>,
    pub envelope_from: String,
    pub envelope_to: Vec<String>,
    pub headers: BTreeMap<String, Vec<String>>,
    pub text_body: Option<String>,
    pub html_body: Option<String>,
    pub snippet: String,
    pub size_bytes: u64,
    pub is_read: bool,
    pub tags: Vec<String>,
    pub source: String,
    pub direction: String,
    pub delivery_status: Option<String>,
    pub open_count: u64,
    pub opened_at_unix_ms: Option<i64>,
    pub otp_codes: Vec<String>,
    pub links: Vec<String>,
    pub smtp_session_id: Option<String>,
    pub smtp_auth_user: Option<String>,
    /// The MIME tree as JSON, shaped by the mail domain.
    pub mime_tree_json: String,
    pub attachments: Vec<AttachmentRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttachmentRecord {
    pub attachment_index: u32,
    pub filename: String,
    pub content_type: String,
    pub size_bytes: u64,
    pub content_id: Option<String>,
    pub is_inline: bool,
}

/// Everything needed to store a new email; the raw message is already compressed.
#[derive(Debug, Clone)]
pub struct NewEmailRecord {
    pub email: EmailRecord,
    pub compressed_raw_message: Vec<u8>,
    pub attachments: Vec<NewAttachmentRecord>,
}

#[derive(Debug, Clone)]
pub struct NewAttachmentRecord {
    pub attachment: AttachmentRecord,
    pub content: Vec<u8>,
}

/// One page of a list, newest first; `next_cursor` continues after its last item.
#[derive(Debug, Clone, PartialEq)]
pub struct EmailPage {
    pub emails: Vec<EmailRecord>,
    pub next_cursor: Option<String>,
    pub total_count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TimelineRecord {
    pub kind: String,
    pub happened_at_unix_ms: i64,
    pub detail: String,
}
