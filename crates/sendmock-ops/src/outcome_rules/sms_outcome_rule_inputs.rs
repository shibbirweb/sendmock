use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::present_value::read_present_value;

/// Match the pattern against the recipient (`to`) or the sender (`from`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum OutcomeRuleMatchField {
    To,
    From,
}

/// What a custom outcome number does to a matching message.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum SmsOutcomeChoice {
    Reject,
    Undelivered,
    Failed,
    DelayedDelivery,
    Read,
}

/// Body of `POST /api/v1/outcome-rules/sms`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SmsOutcomeRuleInput {
    /// Match the pattern against the recipient (`to`) or the sender (`from`).
    pub match_field: OutcomeRuleMatchField,
    /// Exact E.164 number, or `*` for any digits, e.g. `+1555777*`.
    pub pattern: String,
    /// What happens to a matching message: `reject` (the send fails), `undelivered`, `failed`,
    /// `delayed_delivery` or `read`.
    pub outcome: SmsOutcomeChoice,
    /// Required for `reject`, `undelivered` and `failed`.
    #[schemars(required)]
    pub error_code: Option<String>,
    /// Required for `delayed_delivery`.
    #[schemars(required)]
    pub delay_seconds: Option<u32>,
    /// Why the rule exists, shown in the list.
    pub note: String,
    /// Off rules are kept but skipped.
    pub is_enabled: bool,
}

/// `PATCH /api/v1/outcome-rules/sms/{ruleId}`: only the changed keys.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SmsOutcomeRuleUpdate {
    /// The rule's ID, from the list of rules of the same kind.
    pub rule_id: String,
    pub match_field: Option<OutcomeRuleMatchField>,
    pub pattern: Option<String>,
    pub outcome: Option<SmsOutcomeChoice>,
    #[serde(default, deserialize_with = "read_present_value")]
    #[schemars(with = "Option<String>")]
    pub error_code: Option<Option<String>>,
    #[serde(default, deserialize_with = "read_present_value")]
    #[schemars(with = "Option<u32>")]
    pub delay_seconds: Option<Option<u32>>,
    pub note: Option<String>,
    pub is_enabled: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct OutcomeRuleReference {
    /// The rule's ID, from the list of rules of the same kind.
    pub rule_id: String,
}

/// `up` moves the rule one place earlier in the order, `down` one place later.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum OutcomeRuleMoveDirection {
    Up,
    Down,
}

/// Body of `POST /api/v1/outcome-rules/sms/{ruleId}/move`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct OutcomeRuleMoveInput {
    /// The rule's ID, from the list of rules of the same kind.
    pub rule_id: String,
    pub direction: OutcomeRuleMoveDirection,
}

/// Body of `POST /api/v1/outcome-rules/sms/test`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SmsOutcomeTestRequest {
    /// The number to test against the outcome rules and Twilio's magic numbers.
    pub number: String,
    /// Whether the number is the message's recipient (`to`) or sender (`from`).
    pub match_field: OutcomeRuleMatchField,
}
