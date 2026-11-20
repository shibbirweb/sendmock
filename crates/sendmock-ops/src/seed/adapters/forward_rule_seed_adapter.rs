use serde::{Deserialize, Serialize};

use super::message_rule_seed::{
    default_enabled, read_stored_filter, remove_unlisted_message_rules, save_seeded_message_rule,
};
use crate::message_rules::{build_new_rule, check_message_rule, clean_addresses};
use crate::seed::seed_section_adapter::{
    SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::FORWARD_RULES_SECTION;
use crate::webhooks::RuleFilter;
use crate::{OperationContext, OperationError};

/// `[[email.forward_rules]]`, matched by `name`, in the order they run.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedForwardRule {
    name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    filter: Option<RuleFilter>,
    to: Vec<String>,
    #[serde(default = "default_enabled")]
    enabled: bool,
}

pub struct ForwardRuleSeedAdapter;

impl ForwardRuleSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_rule: SeedForwardRule = read_seed_table(item_table)?;
        let addresses = clean_addresses(seed_rule.to);
        let address_problem = addresses
            .is_empty()
            .then_some(("to", "Add at least one address to forward to"));
        check_message_rule(&seed_rule.name, seed_rule.filter.as_ref(), address_problem)?;
        let addresses_json = serde_json::to_string(&addresses)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
        let seeded_rule = build_new_rule(
            operation_context,
            &seed_rule.name,
            seed_rule.filter.as_ref(),
            addresses_json,
            seed_rule.enabled,
        );
        let rule_name = seeded_rule.name.clone();
        save_seeded_message_rule(&operation_context.email_stores.forward_rules, seeded_rule)
            .await?;
        Ok(rule_name)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_rules = operation_context
            .email_stores
            .forward_rules
            .list_rules()
            .await?;
        stored_rules
            .into_iter()
            .map(|stored_rule| {
                let addresses: Vec<String> = serde_json::from_str(&stored_rule.action)
                    .map_err(|read_error| OperationError::Internal(read_error.to_string()))?;
                Ok(SeedItem {
                    item_key: stored_rule.name.clone(),
                    item_name: stored_rule.name.clone(),
                    table: write_seed_table(&SeedForwardRule {
                        filter: read_stored_filter(&stored_rule)?,
                        name: stored_rule.name,
                        to: addresses,
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
        remove_unlisted_message_rules(
            &operation_context.email_stores.forward_rules,
            kept_item_keys,
        )
        .await
    }
}

impl_seed_section_adapter!(ForwardRuleSeedAdapter, FORWARD_RULES_SECTION);
