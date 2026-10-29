use schemars::JsonSchema;
use serde::Deserialize;

/// Body of `POST` and `PATCH /api/v1/verify/services`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct VerifyServiceInput {
    /// The name shown in the code message, e.g. "Your Shop verification code is ...".
    pub friendly_name: String,
    /// Digits in each code, 4 to 10.
    pub code_length: u32,
    /// Always send this code instead of a random one; null for random.
    #[schemars(required)]
    pub fixed_code: Option<String>,
    /// How long a code stays valid, in seconds.
    pub ttl_seconds: u32,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct VerifyServiceUpdate {
    /// The service SID, `VA...`, from `GET /api/v1/verify/services`.
    pub service_sid: String,
    #[serde(flatten)]
    pub changes: VerifyServiceInput,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct VerifyServiceReference {
    /// The service SID, `VA...`, from `GET /api/v1/verify/services`.
    pub service_sid: String,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct VerificationListInput {
    /// The next_cursor of the previous page.
    pub cursor: Option<String>,
    pub limit: Option<u32>,
    /// One status, or several separated by commas.
    pub status: Option<String>,
    /// Part of the recipient's number or address.
    pub to: Option<String>,
    pub channel: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct VerificationReference {
    /// The verification SID, `VE...`, from `GET /api/v1/verify`.
    pub verification_sid: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ForcedVerificationState {
    Approved,
    Canceled,
    Expired,
    MaxAttempts,
}

/// Body of `POST /verify/{verificationSid}/force`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct VerificationForceInput {
    /// The verification SID, `VE...`, from `GET /api/v1/verify`.
    pub verification_sid: String,
    /// The state to force: `approved`, `canceled`, `expired` or `max_attempts`.
    pub state: ForcedVerificationState,
}
