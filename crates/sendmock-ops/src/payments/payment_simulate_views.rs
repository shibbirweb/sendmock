use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::payment_method_views::DeclineReason;

/// What Simulate does to a payment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum PaymentSimulateAction {
    Succeed,
    Decline,
    Refund,
    Dispute,
    AnswerDispute,
    ResolveDispute,
    Expire,
    Capture,
    Void,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum DisputeOutcome {
    Won,
    Lost,
}

/// `POST /api/v1/payments/{paymentId}/simulate`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentSimulateRequest {
    /// The payment's ID, from `GET /api/v1/payments`.
    pub payment_id: String,
    /// What happens to the payment: `succeed`, `decline`, `refund`, `dispute`,
    /// `answer_dispute`, `resolve_dispute`, `expire`, `capture` or `void`.
    pub action: PaymentSimulateAction,
    /// For `decline`: why the bank declined.
    pub decline_reason: Option<DeclineReason>,
    /// For `refund`: the amount in minor units; the full amount left when left out.
    pub refund_amount_minor: Option<u64>,
    /// For `resolve_dispute`: `won` or `lost`.
    pub dispute_outcome: Option<DisputeOutcome>,
    /// For `answer_dispute`: the evidence sent to the bank.
    pub dispute_evidence: Option<String>,
}
