use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::route_wire::InboundRouteAction;

/// Body of `POST /api/v1/inbound-routes/match`: the email about to arrive.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct InboundRouteMatchRequest {
    /// The recipients the incoming email would have, e.g. `support@inbound.app.test`.
    pub to: Vec<String>,
    /// Copied recipients; routes read them like `to`.
    pub cc: Option<Vec<String>>,
    /// Headers by name, e.g. `{ "subject": "Re: Your receipt", "from": "sam@example.test" }`.
    pub headers: Option<BTreeMap<String, String>>,
}

/// A route that would run, with its actions as they would run (named groups filled in).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct MatchedInboundRoute {
    pub route_id: String,
    pub priority: i64,
    pub description: String,
    /// The filter in Mailgun syntax, e.g. `match_recipient("support@.*")`.
    pub expression: String,
    /// The recipient or header value that matched.
    pub matched_value: String,
    pub actions: Vec<InboundRouteAction>,
    /// Each action in Mailgun syntax, e.g. `forward("http://...")`.
    pub action_expressions: Vec<String>,
    /// The route calls `stop()`, so no later route runs.
    pub calls_stop: bool,
}

/// An enabled webhook rule on `email.inbound` whose filter passes the email.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct MatchedWebhookRule {
    pub rule_id: String,
    pub rule_name: String,
    pub endpoint_id: String,
    pub endpoint_name: String,
    pub endpoint_url: String,
}

/// Where an incoming email would go; nothing is stored or sent.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct InboundRouteMatchResult {
    /// The routes that would run, in run order, ending at one that calls `stop()`.
    pub routes: Vec<MatchedInboundRoute>,
    /// The webhook rules on `email.inbound` that would send, in rule order.
    pub webhook_rules: Vec<MatchedWebhookRule>,
}
