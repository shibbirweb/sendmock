use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::SmsOptOutRecord;
use serde::{Deserialize, Serialize};

/// A contact who texted STOP to one of your numbers or Messaging Services.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct SmsOptOut {
    /// Your app's number, or the SID of the Messaging Service it was in, `MG...`.
    pub sender: String,
    /// The contact's number, E.164.
    pub contact_number: String,
    /// The keyword the contact texted, as they wrote it.
    pub keyword: String,
    pub created_at: String,
}

impl From<SmsOptOutRecord> for SmsOptOut {
    fn from(opt_out: SmsOptOutRecord) -> Self {
        Self {
            sender: opt_out.sender,
            contact_number: opt_out.contact_number,
            keyword: opt_out.keyword,
            created_at: format_rfc3339(opt_out.created_at_unix_ms),
        }
    }
}

/// One opt-out, by sender and contact.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SmsOptOutReference {
    /// Your app's number, or a Messaging Service SID, as the opt-out list shows it.
    pub sender: String,
    /// The contact's number, E.164.
    pub contact_number: String,
}
