use sendmock_store::SmsOutcomeRuleRecord;
use serde::{Deserialize, Serialize};

use crate::outcome_rules::validate_sms_outcome_rule;
use crate::seed::seed_section_adapter::{
    CREATED_BY_SEED, SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::SMS_OUTCOME_RULES_SECTION;
use crate::{OperationContext, OperationError};

/// `[[sms.outcome_rules]]`, matched by `match` and `pattern`; new rules go to the bottom of
/// the list in file order.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedSmsOutcomeRule {
    #[serde(rename = "match", default = "default_match_field")]
    match_field: String,
    pattern: String,
    outcome: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    error_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    delay_seconds: Option<u32>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    note: String,
    #[serde(default = "default_enabled")]
    enabled: bool,
}

fn default_match_field() -> String {
    "to".to_owned()
}

fn default_enabled() -> bool {
    true
}

fn rule_key(match_field: &str, pattern: &str) -> String {
    format!("{match_field} {pattern}")
}

pub struct SmsOutcomeRuleSeedAdapter;

impl SmsOutcomeRuleSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_rule: SeedSmsOutcomeRule = read_seed_table(item_table)?;
        if seed_rule.match_field != "to" && seed_rule.match_field != "from" {
            return Err(OperationError::InvalidInput {
                message: "match must be \"to\" or \"from\"".to_owned(),
                field: Some("match".to_owned()),
            });
        }
        let rule_repository = &operation_context.sms_outcome_rule_repository;
        let item_key = rule_key(&seed_rule.match_field, seed_rule.pattern.trim());
        let existing_rule = rule_repository
            .list_rules()
            .await?
            .into_iter()
            .find(|stored_rule| {
                rule_key(&stored_rule.match_field, &stored_rule.pattern) == item_key
            });
        let is_new_rule = existing_rule.is_none();
        let base_rule = existing_rule.unwrap_or_else(|| SmsOutcomeRuleRecord {
            rule_id: operation_context.id_generator.generate_id().to_string(),
            position: 0,
            match_field: String::new(),
            pattern: String::new(),
            outcome: String::new(),
            error_code: None,
            delay_seconds: None,
            note: String::new(),
            is_enabled: true,
            created_by: CREATED_BY_SEED.to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        });
        let seeded_rule = validate_sms_outcome_rule(SmsOutcomeRuleRecord {
            match_field: seed_rule.match_field,
            pattern: seed_rule.pattern,
            outcome: seed_rule.outcome,
            error_code: seed_rule.error_code,
            delay_seconds: seed_rule.delay_seconds,
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
            .sms_outcome_rule_repository
            .list_rules()
            .await?;
        stored_rules
            .into_iter()
            .map(|stored_rule| {
                Ok(SeedItem {
                    item_key: rule_key(&stored_rule.match_field, &stored_rule.pattern),
                    item_name: stored_rule.pattern.clone(),
                    table: write_seed_table(&SeedSmsOutcomeRule {
                        match_field: stored_rule.match_field,
                        pattern: stored_rule.pattern,
                        outcome: stored_rule.outcome,
                        error_code: stored_rule.error_code,
                        delay_seconds: stored_rule.delay_seconds,
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
        let rule_repository = &operation_context.sms_outcome_rule_repository;
        for stored_rule in rule_repository.list_rules().await? {
            let item_key = rule_key(&stored_rule.match_field, &stored_rule.pattern);
            if !kept_item_keys.contains(&item_key) {
                rule_repository.delete_rule(&stored_rule.rule_id).await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(SmsOutcomeRuleSeedAdapter, SMS_OUTCOME_RULES_SECTION);
