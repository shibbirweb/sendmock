use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::request_part_renderer::RenderProblem;

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
    /// Also render the request each matching endpoint would send for the event, with secrets
    /// masked (WH-14.1).
    pub include_requests: Option<bool>,
    /// With `include_requests`, render these endpoints' requests too, as chosen for the
    /// action instead of the rules (IDs from `GET /api/v1/webhooks/endpoints`).
    pub webhook_endpoint_ids: Option<Vec<String>>,
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
    /// With `include_requests`: the request each matching or chosen endpoint would send.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_requests: Option<Vec<MatchedWebhookRequest>>,
}

/// The request one endpoint would send for the event, rendered with its template as a
/// delivery would be; values made at send time (ids, timestamps, `fake.*`) are made again
/// when it is sent unless the body is edited.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct MatchedWebhookRequest {
    pub endpoint_id: String,
    pub endpoint_name: String,
    pub event_type: String,
    pub method: String,
    pub url: String,
    /// Secret values are masked.
    pub headers: BTreeMap<String, String>,
    pub body: String,
    /// Errors stop a delivery as `render_failed`; warnings render empty.
    pub problems: Vec<RenderProblem>,
}
