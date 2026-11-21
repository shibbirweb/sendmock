use sendmock_store::{MessageRuleRecord, MessageRuleRepository};

use crate::OperationError;
use crate::webhooks::RuleFilter;

/// Updates the rule with the same name, keeping its id, place and age, or adds the new one at
/// the end, so applying a seed twice changes nothing.
pub async fn save_seeded_message_rule(
    rule_repository: &MessageRuleRepository,
    seeded_rule: MessageRuleRecord,
) -> Result<(), OperationError> {
    let existing_rule = rule_repository
        .list_rules()
        .await?
        .into_iter()
        .find(|stored_rule| stored_rule.name == seeded_rule.name);
    match existing_rule {
        Some(existing_rule) => {
            rule_repository
                .update_rule(MessageRuleRecord {
                    rule_id: existing_rule.rule_id,
                    position: existing_rule.position,
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

/// Deletes the rules a reset should not keep.
pub async fn remove_unlisted_message_rules(
    rule_repository: &MessageRuleRepository,
    kept_item_keys: &[String],
) -> Result<(), OperationError> {
    for stored_rule in rule_repository.list_rules().await? {
        if !kept_item_keys.contains(&stored_rule.name) {
            rule_repository.delete_rule(&stored_rule.rule_id).await?;
        }
    }
    Ok(())
}

pub fn read_stored_filter(
    stored_rule: &MessageRuleRecord,
) -> Result<Option<RuleFilter>, OperationError> {
    stored_rule
        .filter_json
        .as_deref()
        .map(serde_json::from_str)
        .transpose()
        .map_err(|read_error| OperationError::Internal(read_error.to_string()))
}

pub fn default_enabled() -> bool {
    true
}
