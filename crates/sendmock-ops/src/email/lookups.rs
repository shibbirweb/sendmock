use schemars::JsonSchema;
use serde::Serialize;

/// The latest one-time code sent to a recipient.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct OtpLookup {
    pub to: String,
    pub channel: String,
    pub code: String,
    /// The email (or SMS) the code came in.
    pub source_id: String,
    pub received_at: String,
}

/// The links of the latest email to a recipient.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct LinksLookup {
    pub to: String,
    pub email_id: String,
    pub links: Vec<String>,
    pub received_at: String,
}

/// Answer of `POST /send`: the stored email's id.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct NativeSendResult {
    pub id: String,
}
