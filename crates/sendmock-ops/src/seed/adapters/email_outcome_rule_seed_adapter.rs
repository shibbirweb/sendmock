use sendmock_store::EmailOutcomeRuleRecord;
use serde::{Deserialize, Serialize};

use crate::outcome_rules::validate_email_outcome_rule;
use crate::seed::seed_section_adapter::{
    CREATED_BY_SEED, SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::EMAIL_OUTCOME_RULES_SECTION;
use crate::{OperationContext, OperationError};

/// `[[email.outcome_rules]]`, matched by `pattern`; new rules go to the bottom of the list in
/// file order.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedEmailOutcomeRule {
    pattern: String,
    outcome: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    smtp_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    diagnostic: Option<String>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    note: String,
    #[serde(default = "default_enabled")]
    enabled: bool,
}

fn default_enabled() -> bool {
    true
}

pub struct EmailOutcomeRuleSeedAdapter;

impl EmailOutcomeRuleSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_rule: SeedEmailOutcomeRule = read_seed_table(item_table)?;
        let rule_repository = &operation_context.email_outcome_rule_repository;
        let item_key = seed_rule.pattern.trim().to_owned();
        let existing_rule = rule_repository
            .list_rules()
            .await?
            .into_iter()
            .find(|stored_rule| stored_rule.pattern == item_key);
        let is_new_rule = existing_rule.is_none();
        let base_rule = existing_rule.unwrap_or_else(|| EmailOutcomeRuleRecord {
            rule_id: operation_context.id_generator.generate_id().to_string(),
            position: 0,
            pattern: String::new(),
            outcome: String::new(),
            smtp_code: None,
            diagnostic: None,
            note: String::new(),
            is_enabled: true,
            created_by: CREATED_BY_SEED.to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        });
        let seeded_rule = validate_email_outcome_rule(EmailOutcomeRuleRecord {
            pattern: seed_rule.pattern,
            outcome: seed_rule.outcome,
            smtp_code: seed_rule.smtp_code,
            diagnostic: seed_rule.diagnostic,
            note: seed_rule.note,
            is_enabled: seed_rule.enabled,
            ..base_rule
        })?;
        if is_new_rule {
            rule_repository.insert_rule(seeded_rule).await?;
        } else {
            rule_repository.update_rule(seeded_rule).await?;
        }
        Ok(item_key)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_rules = operation_context
            .email_outcome_rule_repository
            .list_rules()
            .await?;
        stored_rules
            .into_iter()
            .map(|stored_rule| {
                Ok(SeedItem {
                    item_key: stored_rule.pattern.clone(),
                    item_name: stored_rule.pattern.clone(),
                    table: write_seed_table(&SeedEmailOutcomeRule {
                        pattern: stored_rule.pattern,
                        outcome: stored_rule.outcome,
                        smtp_code: stored_rule.smtp_code,
                        diagnostic: stored_rule.diagnostic,
                        note: stored_rule.note,
                        enabled: stored_rule.is_enabled,
                    })?,
                })
            })
            .collect()
    }

    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let rule_repository = &operation_context.email_outcome_rule_repository;
        for stored_rule in rule_repository.list_rules().await? {
            if !kept_item_keys.contains(&stored_rule.pattern) {
                rule_repository.delete_rule(&stored_rule.rule_id).await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(EmailOutcomeRuleSeedAdapter, EMAIL_OUTCOME_RULES_SECTION);
