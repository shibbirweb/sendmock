use serde::{Deserialize, Serialize};

use super::message_rule_seed::{
    default_enabled, read_stored_filter, remove_unlisted_message_rules, save_seeded_message_rule,
};
use crate::message_rules::{build_new_rule, check_message_rule};
use crate::seed::seed_section_adapter::{
    SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::TAG_RULES_SECTION;
use crate::webhooks::RuleFilter;
use crate::{OperationContext, OperationError};

/// `[[email.tag_rules]]`, matched by `name`, in the order they run.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedTagRule {
    name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    filter: Option<RuleFilter>,
    tag: String,
    #[serde(default = "default_enabled")]
    enabled: bool,
}

pub struct TagRuleSeedAdapter;

impl TagRuleSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_rule: SeedTagRule = read_seed_table(item_table)?;
        let tag = seed_rule.tag.trim().to_owned();
        let tag_problem = tag.is_empty().then_some(("tag", "Enter the tag to add"));
        check_message_rule(&seed_rule.name, seed_rule.filter.as_ref(), tag_problem)?;
        let seeded_rule = build_new_rule(
            operation_context,
            &seed_rule.name,
            seed_rule.filter.as_ref(),
            tag,
            seed_rule.enabled,
        );
        let rule_name = seeded_rule.name.clone();
        save_seeded_message_rule(&operation_context.email_stores.tag_rules, seeded_rule).await?;
        Ok(rule_name)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_rules = operation_context
            .email_stores
            .tag_rules
            .list_rules()
            .await?;
        stored_rules
            .into_iter()
            .map(|stored_rule| {
                Ok(SeedItem {
                    item_key: stored_rule.name.clone(),
                    item_name: stored_rule.name.clone(),
                    table: write_seed_table(&SeedTagRule {
                        filter: read_stored_filter(&stored_rule)?,
                        name: stored_rule.name,
                        tag: stored_rule.action,
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
        remove_unlisted_message_rules(&operation_context.email_stores.tag_rules, kept_item_keys)
            .await
    }
}

impl_seed_section_adapter!(TagRuleSeedAdapter, TAG_RULES_SECTION);
