use schemars::JsonSchema;
use sendmock_store::EmailOutcomeRuleRecord;
use serde::Serialize;

/// A custom outcome address: first enabled match wins.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct EmailOutcomeRule {
    pub id: String,
    /// 1-based order; lower numbers are checked first.
    pub position: u32,
    pub pattern: String,
    pub outcome: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub smtp_code: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub diagnostic: Option<String>,
    pub note: String,
    pub is_enabled: bool,
    pub created_by: String,
}

impl From<EmailOutcomeRuleRecord> for EmailOutcomeRule {
    fn from(stored_rule: EmailOutcomeRuleRecord) -> Self {
        Self {
            id: stored_rule.rule_id,
            position: stored_rule.position,
            pattern: stored_rule.pattern,
            outcome: stored_rule.outcome,
            smtp_code: stored_rule.smtp_code,
            diagnostic: stored_rule.diagnostic,
            note: stored_rule.note,
            is_enabled: stored_rule.is_enabled,
            created_by: stored_rule.created_by,
        }
    }
}
