use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::{EmailRecord, StoredEmailAddress};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct EmailAddress {
    pub name: String,
    pub address: String,
}

impl From<&StoredEmailAddress> for EmailAddress {
    fn from(stored_address: &StoredEmailAddress) -> Self {
        Self {
            name: stored_address.name.clone(),
            address: stored_address.address.clone(),
        }
    }
}

pub fn to_email_addresses(stored_addresses: &[StoredEmailAddress]) -> Vec<EmailAddress> {
    stored_addresses.iter().map(EmailAddress::from).collect()
}

/// Fields shown in the mail list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct EmailSummary {
    pub id: String,
    pub received_at: String,
    pub from: EmailAddress,
    pub to: Vec<EmailAddress>,
    pub subject: String,
    pub snippet: String,
    pub size_bytes: u64,
    pub attachment_count: u64,
    pub is_read: bool,
    pub tags: Vec<String>,
    pub source: String,
    #[schemars(required)]
    pub delivery_status: Option<String>,
    pub open_count: u64,
    pub has_otp: bool,
    pub direction: String,
    /// Set on inbound emails made by Reply or Forward, for the list icon.
    #[schemars(required)]
    pub response_kind: Option<String>,
}

impl From<&EmailRecord> for EmailSummary {
    fn from(email: &EmailRecord) -> Self {
        Self {
            id: email.email_id.clone(),
            received_at: format_rfc3339(email.received_at_unix_ms),
            from: EmailAddress::from(&email.from),
            to: to_email_addresses(&email.to),
            subject: email.subject.clone(),
            snippet: email.snippet.clone(),
            size_bytes: email.size_bytes,
            attachment_count: u64::try_from(email.attachments.len()).unwrap_or_default(),
            is_read: email.is_read,
            tags: email.tags.clone(),
            source: email.source.clone(),
            delivery_status: email.delivery_status.clone(),
            open_count: email.open_count,
            has_otp: !email.otp_codes.is_empty(),
            direction: email.direction.clone(),
            response_kind: None,
        }
    }
}
