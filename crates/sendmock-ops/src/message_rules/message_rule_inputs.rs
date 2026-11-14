use schemars::JsonSchema;
use serde::Deserialize;

use crate::outcome_rules::OutcomeRuleMoveDirection;
use crate::present_value::read_present_value;
use crate::webhooks::RuleFilter;

/// Body of `POST /api/v1/tag-rules`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TagRuleInput {
    /// A name for the rule, shown in the list.
    pub name: String,
    /// The webhook rule filter, over email fields; null matches every email.
    #[schemars(required, schema_with = "crate::nullable_schema::<RuleFilter>")]
    pub filter: Option<RuleFilter>,
    /// The tag added to each matching email.
    pub tag: String,
    /// Off rules are kept but skipped.
    pub is_enabled: bool,
}

/// `PATCH /api/v1/tag-rules/{ruleId}`: only the changed keys.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TagRuleUpdate {
    /// The rule's ID, from the list of rules of the same kind.
    pub rule_id: String,
    pub name: Option<String>,
    #[serde(default, deserialize_with = "read_present_value")]
    #[schemars(with = "Option<RuleFilter>")]
    pub filter: Option<Option<RuleFilter>>,
    pub tag: Option<String>,
    pub is_enabled: Option<bool>,
}

/// Body of `POST /api/v1/forward-rules`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ForwardRuleInput {
    /// A name for the rule, shown in the list.
    pub name: String,
    /// The webhook rule filter, over email fields; null matches every email.
    #[schemars(required, schema_with = "crate::nullable_schema::<RuleFilter>")]
    pub filter: Option<RuleFilter>,
    /// Real addresses; each must be on the relay allowlist.
    pub to: Vec<String>,
    /// Off rules are kept but skipped.
    pub is_enabled: bool,
}

/// `PATCH /api/v1/forward-rules/{ruleId}`: only the changed keys.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ForwardRuleUpdate {
    /// The rule's ID, from the list of rules of the same kind.
    pub rule_id: String,
    pub name: Option<String>,
    #[serde(default, deserialize_with = "read_present_value")]
    #[schemars(with = "Option<RuleFilter>")]
    pub filter: Option<Option<RuleFilter>>,
    pub to: Option<Vec<String>>,
    pub is_enabled: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct MessageRuleReference {
    /// The rule's ID, from the list of rules of the same kind.
    pub rule_id: String,
}

/// Body of `POST /api/v1/tag-rules/{ruleId}/move` and `/forward-rules/{ruleId}/move`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct MessageRuleMoveInput {
    /// The rule's ID, from the list of rules of the same kind.
    pub rule_id: String,
    pub direction: OutcomeRuleMoveDirection,
}
