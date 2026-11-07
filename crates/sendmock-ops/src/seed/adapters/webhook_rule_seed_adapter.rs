use sendmock_store::WebhookRuleRecord;
use serde::{Deserialize, Serialize};

use super::endpoint_names::EndpointNames;
use crate::seed::seed_section_adapter::{
    CREATED_BY_SEED, SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::WEBHOOK_RULES_SECTION;
use crate::webhooks::{RuleFilter, validate_rule};
use crate::{OperationContext, OperationError};

/// `[[webhook.rules]]`, matched by `name`; `endpoint` is the endpoint's name and `filter` takes
/// the same shape as the API.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedWebhookRule {
    name: String,
    endpoint: String,
    events: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    filter: Option<RuleFilter>,
    #[serde(default = "default_enabled")]
    enabled: bool,
}

fn default_enabled() -> bool {
    true
}

fn write_json(value: &impl Serialize) -> Result<String, OperationError> {
    serde_json::to_string(value)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

pub struct WebhookRuleSeedAdapter;

impl WebhookRuleSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_rule: SeedWebhookRule = read_seed_table(item_table)?;
        let rule_name = seed_rule.name.trim().to_owned();
        let endpoint_id = EndpointNames::load(operation_context)
            .await?
            .find_id(&seed_rule.endpoint)?;
        validate_rule(
            operation_context,
            &rule_name,
            &endpoint_id,
            &seed_rule.events,
            seed_rule.filter.as_ref(),
        )
        .await?;
        let events_json = write_json(&seed_rule.events)?;
        let filter_json = seed_rule.filter.as_ref().map(write_json).transpose()?;
        save_seeded_rule(
            operation_context,
            WebhookRuleRecord {
                rule_id: operation_context.id_generator.generate_id().to_string(),
                position: 0,
                name: rule_name.clone(),
                endpoint_id,
                events_json,
                filter_json,
                is_enabled: seed_rule.enabled,
                created_by: CREATED_BY_SEED.to_owned(),
                created_at_unix_ms: operation_context.clock.now_unix_ms(),
            },
        )
        .await?;
        Ok(rule_name)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let endpoint_names = EndpointNames::load(operation_context).await?;
        let stored_rules = operation_context
            .webhook_rule_repository
            .list_rules()
            .await?;
        stored_rules
            .into_iter()
            .map(|stored_rule| {
                let read_json_error = |read_error: serde_json::Error| {
                    OperationError::Internal(read_error.to_string())
                };
                Ok(SeedItem {
                    item_key: stored_rule.name.clone(),
                    item_name: stored_rule.name.clone(),
                    table: write_seed_table(&SeedWebhookRule {
                        endpoint: endpoint_names
                            .find_name(&stored_rule.endpoint_id)
                            .unwrap_or_default(),
                        events: serde_json::from_str(&stored_rule.events_json)
                            .map_err(read_json_error)?,
                        filter: stored_rule
                            .filter_json
                            .as_deref()
                            .map(serde_json::from_str)
                            .transpose()
                            .map_err(read_json_error)?,
                        enabled: stored_rule.is_enabled,
                        name: stored_rule.name,
                    })?,
                })
            })
            .collect()
    }

    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let rule_repository = &operation_context.webhook_rule_repository;
        for stored_rule in rule_repository.list_rules().await? {
            if !kept_item_keys.contains(&stored_rule.name) {
                rule_repository.delete_rule(&stored_rule.rule_id).await?;
            }
        }
        Ok(())
    }
}

/// Updates the rule with the same name, keeping its id, place and origin, or adds the new one.
async fn save_seeded_rule(
    operation_context: &OperationContext,
    seeded_rule: WebhookRuleRecord,
) -> Result<(), OperationError> {
    let rule_repository = &operation_context.webhook_rule_repository;
    let existing_rule = rule_repository
        .list_rules()
        .await?
        .into_iter()
        .find(|stored_rule| stored_rule.name == seeded_rule.name);
    match existing_rule {
        Some(existing_rule) => {
            rule_repository
                .update_rule(WebhookRuleRecord {
                    rule_id: existing_rule.rule_id,
                    position: existing_rule.position,
                    created_by: existing_rule.created_by,
                    created_at_unix_ms: existing_rule.created_at_unix_ms,
                    ..seeded_rule
                })
                .await?;
        }
        None => {
            rule_repository.insert_rule(seeded_rule).await?;
        }
    }
    Ok(())
}

impl_seed_section_adapter!(WebhookRuleSeedAdapter, WEBHOOK_RULES_SECTION);
