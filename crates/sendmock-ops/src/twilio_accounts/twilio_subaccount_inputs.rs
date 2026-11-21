use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// A Twilio account's status, as the Accounts API writes it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum TwilioAccountStatus {
    #[default]
    Active,
    Suspended,
    Closed,
}

impl TwilioAccountStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Suspended => "suspended",
            Self::Closed => "closed",
        }
    }

    /// The stored text, or `None` when it is not one of Twilio's statuses.
    pub fn parse(status_text: &str) -> Option<Self> {
        match status_text.trim().to_ascii_lowercase().as_str() {
            "active" => Some(Self::Active),
            "suspended" => Some(Self::Suspended),
            "closed" => Some(Self::Closed),
            _ => None,
        }
    }
}

/// What can be set on a subaccount.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TwilioSubaccountChanges {
    /// A name for the subaccount, e.g. the customer it belongs to.
    pub friendly_name: String,
    #[serde(default)]
    pub status: TwilioAccountStatus,
    /// The subaccount's auth token. Null, empty or the masked value keeps the stored token;
    /// a new subaccount without one gets a generated token.
    #[serde(default)]
    #[schemars(schema_with = "crate::nullable_schema::<String>")]
    pub auth_token: Option<String>,
    /// Where Twilio Debugger events for this subaccount are sent; null for none.
    #[serde(default)]
    #[schemars(schema_with = "crate::nullable_schema::<String>")]
    pub debugger_url: Option<String>,
}

/// Body of `POST /api/v1/twilio/subaccounts`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TwilioSubaccountInput {
    /// `AC` and 32 hex digits; null makes a new one.
    #[serde(default)]
    #[schemars(schema_with = "crate::nullable_schema::<String>")]
    pub account_sid: Option<String>,
    #[serde(flatten)]
    pub changes: TwilioSubaccountChanges,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TwilioSubaccountUpdate {
    /// The subaccount SID, `AC...`, from `GET /api/v1/twilio/subaccounts`.
    pub account_sid: String,
    #[serde(flatten)]
    pub changes: TwilioSubaccountChanges,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TwilioSubaccountReference {
    /// The subaccount SID, `AC...`, from `GET /api/v1/twilio/subaccounts`.
    pub account_sid: String,
}
