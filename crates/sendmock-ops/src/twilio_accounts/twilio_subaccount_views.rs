use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::TwilioSubaccountRecord;
use serde::Serialize;

use crate::message_providers::mask_secret_value;

/// A subaccount as the API shows it; the auth token is masked.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct TwilioSubaccount {
    pub account_sid: String,
    pub friendly_name: String,
    /// `active`, `suspended` or `closed`.
    pub status: String,
    /// `••••` and the last four characters; reveal it with the CLI or the provider sheet.
    pub auth_token: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub debugger_url: Option<String>,
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<TwilioSubaccountRecord> for TwilioSubaccount {
    fn from(stored_subaccount: TwilioSubaccountRecord) -> Self {
        Self {
            account_sid: stored_subaccount.account_sid,
            friendly_name: stored_subaccount.friendly_name,
            status: stored_subaccount.status,
            auth_token: mask_secret_value(&stored_subaccount.auth_token),
            debugger_url: stored_subaccount.debugger_url,
            created_by: stored_subaccount.created_by,
            created_at: format_rfc3339(stored_subaccount.created_at_unix_ms),
            updated_at: format_rfc3339(stored_subaccount.updated_at_unix_ms),
        }
    }
}

/// A subaccount's auth token, shown in full after a confirmation.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct TwilioSubaccountTokenReveal {
    pub account_sid: String,
    pub auth_token: String,
}
