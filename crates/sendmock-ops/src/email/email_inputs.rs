use schemars::JsonSchema;
use serde::Deserialize;

/// Names one email by its id.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailReference {
    pub email_id: String,
}

/// Names one attachment of an email by its position.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct AttachmentReference {
    pub email_id: String,
    pub attachment_index: u32,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct EmailListQuery {
    /// Continue after this page's `next_cursor`.
    pub cursor: Option<String>,
    /// How many emails per page (default 50, at most 500).
    pub limit: Option<u32>,
    /// Search text; supports from:, to: and tag: prefixes.
    pub query: Option<String>,
    /// Sender contains.
    pub from: Option<String>,
    /// A recipient contains.
    pub to: Option<String>,
    /// Has this tag.
    pub tag: Option<String>,
    /// Only unread.
    pub is_unread: Option<bool>,
    /// Only with attachments.
    pub has_attachment: Option<bool>,
    /// How it arrived: smtp, sendmail, native_api, or an email provider's key.
    pub source: Option<String>,
    /// Outbound from your app or inbound to it.
    pub direction: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailUpdateInput {
    pub email_id: String,
    /// Marks the email as read (true) or unread (false).
    pub is_read: Option<bool>,
    /// Replaces the email's tags; an empty list removes them all.
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct LatestEmailQuery {
    /// The recipient address.
    pub to: String,
    /// Subject contains.
    pub subject: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailWaitQuery {
    /// A recipient contains.
    pub to: Option<String>,
    /// Subject contains.
    pub subject: Option<String>,
    /// Only emails received after this time (default: 30 s ago).
    pub since: Option<String>,
    /// How long to wait, e.g. 30s (default 30s).
    pub timeout: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct RecipientLookupQuery {
    /// The recipient.
    pub to: String,
    /// email or sms (default: email).
    pub channel: Option<String>,
    /// How long to wait for a first match, e.g. 10s (default: answer at once).
    pub timeout: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct LinksQuery {
    /// The recipient.
    pub to: String,
    /// How long to wait for a first match, e.g. 10s (default: answer at once).
    pub timeout: Option<String>,
}

/// A whole message (RFC 5322), as sent by your app.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct RawMessageInput {
    pub raw_message: String,
}
