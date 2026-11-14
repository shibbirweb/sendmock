use schemars::JsonSchema;
use serde::Deserialize;

use super::payment_method_views::DeclineReason;

/// What the customer does on the checkout page.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum CheckoutAction {
    Pay,
    Decline,
    Cancel,
    Delay,
    RequireThreeDs,
    ThreeDsApprove,
    ThreeDsFail,
}

/// A card typed on the checkout page: only test cards are accepted, and the number is never
/// stored. The page also sends `cvc` and `holder_name`, which are ignored, so never kept.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct CheckoutCard {
    /// A test card number of the method.
    pub number: String,
    /// Expiry month, 1 to 12.
    pub exp_month: u32,
    /// Expiry year, four digits.
    pub exp_year: u32,
}

/// What the customer typed in a flow's steps; only the flow's own steps are read.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct CheckoutStepEntries {
    /// An account number or voucher code.
    pub number: Option<String>,
    /// The one-time code typed in an OTP step.
    pub otp: Option<String>,
    /// The PIN typed in a PIN step.
    pub pin: Option<String>,
}

/// `POST /api/v1/checkout-sessions/{sessionId}/complete`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct CheckoutCompleteRequest {
    /// The checkout session's id, which is the payment's id.
    pub session_id: String,
    pub action: CheckoutAction,
    /// The method the customer paid with.
    pub method_key: Option<String>,
    /// The card typed, for card methods.
    pub card: Option<CheckoutCard>,
    /// What was typed in the flow's other steps.
    pub entries: Option<CheckoutStepEntries>,
    /// For `decline`: why the bank declined.
    pub decline_reason: Option<DeclineReason>,
}
