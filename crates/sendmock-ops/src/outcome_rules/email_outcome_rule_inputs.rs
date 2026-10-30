use schemars::JsonSchema;
use sendmock_mail::EmailRuleOutcome;
use serde::Deserialize;

use crate::present_value::read_present_value;

/// What a custom outcome address does to a matching email.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum EmailOutcomeChoice {
    Delivered,
    HardBounce,
    SoftBounce,
    Complaint,
    Unsubscribe,
    Reject,
}

impl EmailOutcomeChoice {
    pub fn to_rule_outcome(self) -> EmailRuleOutcome {
        match self {
            Self::Delivered => EmailRuleOutcome::Delivered,
            Self::HardBounce => EmailRuleOutcome::HardBounce,
            Self::SoftBounce => EmailRuleOutcome::SoftBounce,
            Self::Complaint => EmailRuleOutcome::Complaint,
            Self::Unsubscribe => EmailRuleOutcome::Unsubscribe,
            Self::Reject => EmailRuleOutcome::Reject,
        }
    }
}

/// Body of `POST /api/v1/outcome-rules/email`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailOutcomeRuleInput {
    /// Exact address, or `*` wildcards, e.g. `*@bounce.qa.test`.
    pub pattern: String,
    /// What happens to a matching email: `delivered`, `hard_bounce`, `soft_bounce`,
    /// `complaint`, `unsubscribe` or `reject` (refused during SMTP `RCPT` and the HTTP send).
    pub outcome: EmailOutcomeChoice,
    /// SMTP reply for bounces and rejects, e.g. `550 5.1.1`.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub smtp_code: Option<String>,
    /// The diagnostic text sent with the SMTP code.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub diagnostic: Option<String>,
    /// Why the rule exists, shown in the list.
    pub note: String,
    /// Off rules are kept but skipped.
    pub is_enabled: bool,
}

/// `PATCH /api/v1/outcome-rules/email/{ruleId}`: only the changed keys.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailOutcomeRuleUpdate {
    /// The rule's ID, from the list of rules of the same kind.
    pub rule_id: String,
    pub pattern: Option<String>,
    pub outcome: Option<EmailOutcomeChoice>,
    #[serde(default, deserialize_with = "read_present_value")]
    #[schemars(with = "Option<String>")]
    pub smtp_code: Option<Option<String>>,
    #[serde(default, deserialize_with = "read_present_value")]
    #[schemars(with = "Option<String>")]
    pub diagnostic: Option<Option<String>>,
    pub note: Option<String>,
    pub is_enabled: Option<bool>,
}

/// Body of `POST /api/v1/outcome-rules/email/test`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailOutcomeTestRequest {
    /// The address to test against the outcome rules and magic addresses.
    pub address: String,
}
