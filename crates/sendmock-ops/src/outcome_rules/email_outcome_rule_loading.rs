use sendmock_mail::{EmailOutcomeRule, EmailRuleOutcome};
use sendmock_store::EmailOutcomeRuleRecord;

use crate::{OperationContext, OperationError};

/// The custom outcome addresses in order, as the planner and the tester read them.
pub async fn load_email_outcome_rules(
    operation_context: &OperationContext,
) -> Result<Vec<EmailOutcomeRule>, OperationError> {
    let stored_rules = operation_context
        .email_outcome_rule_repository
        .list_rules()
        .await?;
    Ok(stored_rules
        .into_iter()
        .filter_map(to_email_outcome_rule)
        .collect())
}

/// `None` for a stored rule this version cannot read, which is then skipped.
fn to_email_outcome_rule(stored_rule: EmailOutcomeRuleRecord) -> Option<EmailOutcomeRule> {
    Some(EmailOutcomeRule {
        outcome: EmailRuleOutcome::parse(&stored_rule.outcome)?,
        rule_id: stored_rule.rule_id,
        position: stored_rule.position,
        pattern: stored_rule.pattern,
        smtp_code: stored_rule.smtp_code,
        diagnostic: stored_rule.diagnostic,
        is_enabled: stored_rule.is_enabled,
    })
}
