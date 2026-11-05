use schemars::JsonSchema;
use sendmock_store::MessageRuleRecord;
use serde::Serialize;

use crate::webhooks::RuleFilter;

fn read_stored_filter(rule_record: &MessageRuleRecord) -> Option<RuleFilter> {
    rule_record
        .filter_json
        .as_deref()
        .and_then(|filter_json| serde_json::from_str(filter_json).ok())
}

/// Adds a tag to arriving emails that match its filter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct TagRule {
    pub id: String,
    pub name: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<RuleFilter>")]
    pub filter: Option<RuleFilter>,
    pub tag: String,
    pub is_enabled: bool,
    /// One-based; rules run in this order.
    pub position: u32,
}

impl From<MessageRuleRecord> for TagRule {
    fn from(rule_record: MessageRuleRecord) -> Self {
        Self {
            filter: read_stored_filter(&rule_record),
            id: rule_record.rule_id,
            name: rule_record.name,
            tag: rule_record.action,
            is_enabled: rule_record.is_enabled,
            position: rule_record.position,
        }
    }
}

/// Releases arriving emails that match its filter to real addresses.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct ForwardRule {
    pub id: String,
    pub name: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<RuleFilter>")]
    pub filter: Option<RuleFilter>,
    pub to: Vec<String>,
    pub is_enabled: bool,
    /// One-based; rules run in this order.
    pub position: u32,
}

impl From<MessageRuleRecord> for ForwardRule {
    fn from(rule_record: MessageRuleRecord) -> Self {
        Self {
            filter: read_stored_filter(&rule_record),
            to: serde_json::from_str(&rule_record.action).unwrap_or_default(),
            id: rule_record.rule_id,
            name: rule_record.name,
            is_enabled: rule_record.is_enabled,
            position: rule_record.position,
        }
    }
}
