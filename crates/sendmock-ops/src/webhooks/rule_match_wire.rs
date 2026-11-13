use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Body of `POST /api/v1/webhooks/rules/match`: the event an action is about to fire.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookRuleMatchRequest {
    /// The event the action fires, e.g. `email.bounced` or `sms.status`.
    pub event_type: String,
    /// The email, SMS, payment or push notification the event is about; its stored fields
    /// are what the rule filters read.
    pub subject_id: Option<String>,
    /// Filter fields by name, for a message not stored yet or the values the event changes,
    /// e.g. `{ "to": ["support@app.test"], "header:x-tenant": ["acme"] }`; they win over the
    /// stored message's.
    pub data: Option<BTreeMap<String, Vec<String>>>,
}

/// An enabled webhook rule on the event whose filter passes, with its endpoint.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct MatchedWebhookRule {
    pub rule_id: String,
    pub rule_name: String,
    pub endpoint_id: String,
    pub endpoint_name: String,
    pub endpoint_url: String,
}

/// The webhooks an event would trigger; nothing is stored or sent.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct WebhookRuleMatchResult {
    /// The rules that would send, in rule order.
    pub webhook_rules: Vec<MatchedWebhookRule>,
}
