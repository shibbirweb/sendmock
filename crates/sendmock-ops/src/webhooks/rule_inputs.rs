use schemars::JsonSchema;
use serde::Deserialize;

use super::rule_filter_wire::RuleFilter;
use crate::present_value::read_present_value;

/// Body of `POST /api/v1/webhooks/rules`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookRuleInput {
    /// A name for the rule, shown in the list.
    pub name: String,
    /// The endpoint deliveries go to.
    pub endpoint_id: String,
    /// The events the rule listens to, e.g. `email.received`.
    pub events: Vec<String>,
    /// Only events whose message passes the filter fire; null passes every one.
    #[schemars(required, schema_with = "crate::nullable_schema::<RuleFilter>")]
    pub filter: Option<RuleFilter>,
    /// Off rules are kept but never fire.
    pub is_enabled: bool,
}

/// `PATCH /api/v1/webhooks/rules/{ruleId}`: only the changed keys.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookRuleUpdate {
    /// The rule's ID, from `GET /api/v1/webhooks/rules`.
    pub rule_id: String,
    pub name: Option<String>,
    pub endpoint_id: Option<String>,
    pub events: Option<Vec<String>>,
    #[serde(default, deserialize_with = "read_present_value")]
    #[schemars(with = "Option<RuleFilter>")]
    pub filter: Option<Option<RuleFilter>>,
    pub is_enabled: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookRuleReference {
    /// The rule's ID, from `GET /api/v1/webhooks/rules`.
    pub rule_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum WebhookRuleMoveDirection {
    Up,
    Down,
}

/// Body of `POST /api/v1/webhooks/rules/{ruleId}/move`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookRuleMoveInput {
    /// The rule's ID, from `GET /api/v1/webhooks/rules`.
    pub rule_id: String,
    /// `up` fires the rule one place earlier, `down` one place later.
    pub direction: WebhookRuleMoveDirection,
}

/// Body of `POST /api/v1/webhooks/rules/preview`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct RulePreviewRequest {
    /// The events of the unsaved rule.
    pub events: Vec<String>,
    /// The filter of the unsaved rule; null passes every message.
    #[schemars(required, schema_with = "crate::nullable_schema::<RuleFilter>")]
    pub filter: Option<RuleFilter>,
}
