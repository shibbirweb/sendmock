use schemars::JsonSchema;
use sendmock_sms::{MatchField, SmsOutcomeKind};
use sendmock_store::SmsOutcomeRuleRecord;
use serde::Serialize;

use super::sms_outcome_rule_inputs::{OutcomeRuleMatchField, SmsOutcomeChoice};

/// A custom outcome number: first enabled match wins.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SmsOutcomeRule {
    pub id: String,
    /// 1-based order; lower numbers are checked first.
    pub position: u32,
    pub match_field: String,
    pub pattern: String,
    pub outcome: String,
    #[schemars(required)]
    pub error_code: Option<String>,
    #[schemars(required)]
    pub delay_seconds: Option<u32>,
    pub note: String,
    pub is_enabled: bool,
    pub created_by: String,
}

impl From<SmsOutcomeRuleRecord> for SmsOutcomeRule {
    fn from(stored_rule: SmsOutcomeRuleRecord) -> Self {
        Self {
            id: stored_rule.rule_id,
            position: stored_rule.position,
            match_field: stored_rule.match_field,
            pattern: stored_rule.pattern,
            outcome: stored_rule.outcome,
            error_code: stored_rule.error_code,
            delay_seconds: stored_rule.delay_seconds,
            note: stored_rule.note,
            is_enabled: stored_rule.is_enabled,
            created_by: stored_rule.created_by,
        }
    }
}

/// Which source decides an outcome: a custom rule, a magic number, or the profile.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct OutcomeTestResult {
    /// `custom`, `magic` or `profile`.
    pub source: String,
    #[schemars(required)]
    pub rule_id: Option<String>,
    /// One-based position of the matching custom rule.
    #[schemars(required)]
    pub rule_position: Option<u32>,
    /// What the testers show, e.g. "Custom rule 2: Accepted, then undelivered, 30007".
    pub summary: String,
}

pub fn to_match_field(match_field: OutcomeRuleMatchField) -> MatchField {
    match match_field {
        OutcomeRuleMatchField::To => MatchField::To,
        OutcomeRuleMatchField::From => MatchField::From,
    }
}

pub fn to_outcome_kind(outcome_choice: SmsOutcomeChoice) -> SmsOutcomeKind {
    match outcome_choice {
        SmsOutcomeChoice::Reject => SmsOutcomeKind::Reject,
        SmsOutcomeChoice::Undelivered => SmsOutcomeKind::Undelivered,
        SmsOutcomeChoice::Failed => SmsOutcomeKind::Failed,
        SmsOutcomeChoice::DelayedDelivery => SmsOutcomeKind::DelayedDelivery,
        SmsOutcomeChoice::Read => SmsOutcomeKind::Read,
    }
}
