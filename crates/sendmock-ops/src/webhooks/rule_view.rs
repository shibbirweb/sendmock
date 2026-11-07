use schemars::JsonSchema;
use sendmock_store::WebhookRuleRecord;
use serde::Serialize;

use super::rule_filter_wire::RuleFilter;
use crate::OperationError;

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct WebhookRule {
    pub id: String,
    pub name: String,
    pub endpoint_id: String,
    pub events: Vec<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<RuleFilter>")]
    pub filter: Option<RuleFilter>,
    pub is_enabled: bool,
    /// Firing order, starting at 1.
    pub order: u32,
    pub created_by: String,
}

pub fn read_rule_events(stored_rule: &WebhookRuleRecord) -> Result<Vec<String>, OperationError> {
    serde_json::from_str(&stored_rule.events_json).map_err(|parse_error| {
        OperationError::Internal(format!(
            "the stored events of rule {} do not parse: {parse_error}",
            stored_rule.rule_id
        ))
    })
}

pub fn read_rule_filter(
    stored_rule: &WebhookRuleRecord,
) -> Result<Option<RuleFilter>, OperationError> {
    stored_rule
        .filter_json
        .as_deref()
        .map(serde_json::from_str)
        .transpose()
        .map_err(|parse_error| {
            OperationError::Internal(format!(
                "the stored filter of rule {} does not parse: {parse_error}",
                stored_rule.rule_id
            ))
        })
}

pub fn build_rule_view(stored_rule: WebhookRuleRecord) -> Result<WebhookRule, OperationError> {
    let events = read_rule_events(&stored_rule)?;
    let filter = read_rule_filter(&stored_rule)?;
    Ok(WebhookRule {
        id: stored_rule.rule_id,
        name: stored_rule.name,
        endpoint_id: stored_rule.endpoint_id,
        events,
        filter,
        is_enabled: stored_rule.is_enabled,
        order: stored_rule.position,
        created_by: stored_rule.created_by,
    })
}
