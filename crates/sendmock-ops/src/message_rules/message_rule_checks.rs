use sendmock_store::{MessageRuleRecord, MessageRuleRepository};

use crate::webhooks::{RuleFilter, validate_rule_filter};
use crate::{OperationContext, OperationError};

fn field_error(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

/// The mock's checks, as the rule editor makes them: a name, the tag or at least one address,
/// and a complete filter.
pub fn check_message_rule(
    rule_name: &str,
    rule_filter: Option<&RuleFilter>,
    action_problem: Option<(&str, &str)>,
) -> Result<(), OperationError> {
    if rule_name.trim().is_empty() {
        return Err(field_error("name", "Enter a name"));
    }
    if let Some((field_name, message)) = action_problem {
        return Err(field_error(field_name, message));
    }
    validate_rule_filter(rule_filter)
}

pub fn write_filter_json(rule_filter: Option<&RuleFilter>) -> Option<String> {
    rule_filter.and_then(|rule_filter| serde_json::to_string(rule_filter).ok())
}

/// A new rule record, placed at the end of the order by the repository.
pub fn build_new_rule(
    operation_context: &OperationContext,
    rule_name: &str,
    rule_filter: Option<&RuleFilter>,
    action: String,
    is_enabled: bool,
) -> MessageRuleRecord {
    MessageRuleRecord {
        rule_id: operation_context.id_generator.generate_id().to_string(),
        position: 0,
        name: rule_name.trim().to_owned(),
        filter_json: write_filter_json(rule_filter),
        action,
        is_enabled,
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
    }
}

pub async fn find_rule_or_not_found(
    rule_repository: &MessageRuleRepository,
    rule_id: &str,
    rule_kind_name: &str,
) -> Result<MessageRuleRecord, OperationError> {
    rule_repository
        .find_rule(rule_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No {rule_kind_name} with id {rule_id}"),
        })
}

/// The addresses trimmed, without blanks.
pub fn clean_addresses(addresses: Vec<String>) -> Vec<String> {
    addresses
        .into_iter()
        .map(|address| address.trim().to_owned())
        .filter(|address| !address.is_empty())
        .collect()
}
