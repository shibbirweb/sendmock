use std::collections::BTreeMap;

use schemars::JsonSchema;
use sendmock_mail::RouteFilterRule;
use serde::{Deserialize, Serialize};

/// Which incoming emails a route takes (Mailgun's filters).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum InboundRouteFilter {
    /// A regular expression on each recipient; named groups can be used in actions as
    /// `\g<name>`.
    MatchRecipient { pattern: String },
    /// A regular expression on a header, e.g. `subject`.
    MatchHeader {
        header_name: String,
        pattern: String,
    },
    /// Every incoming email.
    CatchAll,
}

impl InboundRouteFilter {
    pub fn to_filter_rule(&self) -> RouteFilterRule {
        match self {
            Self::MatchRecipient { pattern } => RouteFilterRule::MatchRecipient {
                pattern: pattern.clone(),
            },
            Self::MatchHeader {
                header_name,
                pattern,
            } => RouteFilterRule::MatchHeader {
                header_name: header_name.clone(),
                pattern: pattern.clone(),
            },
            Self::CatchAll => RouteFilterRule::CatchAll,
        }
    }
}

/// What a route does with a matching email, in order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum InboundRouteAction {
    /// POSTs the parsed email to a URL in Mailgun's format.
    ForwardUrl { url: String },
    /// Forwards to a real address, only through the release allowlist.
    ForwardEmail { address: String },
    /// Keeps the message and can POST a notification with its `message-url`.
    Store {
        #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
        notify_url: Option<String>,
    },
    /// Skips the routes with a higher priority number.
    Stop,
}

/// Body of `POST /api/v1/inbound-routes` and `PATCH /api/v1/inbound-routes/{routeId}`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct InboundRouteInput {
    /// Lower runs first.
    pub priority: i64,
    /// A name for the route, shown in the list.
    pub description: String,
    pub filter: InboundRouteFilter,
    pub actions: Vec<InboundRouteAction>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct InboundRouteUpdate {
    /// The route's ID, from `GET /api/v1/inbound-routes`.
    pub route_id: String,
    pub priority: i64,
    pub description: String,
    pub filter: InboundRouteFilter,
    pub actions: Vec<InboundRouteAction>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct InboundRouteReference {
    /// The route's ID, from `GET /api/v1/inbound-routes`.
    pub route_id: String,
}

/// A Mailgun-style inbound route.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct InboundRoute {
    pub id: String,
    pub priority: i64,
    pub description: String,
    pub filter: InboundRouteFilter,
    /// The filter in Mailgun syntax, e.g. `match_recipient("support@.*")`.
    pub expression: String,
    pub actions: Vec<InboundRouteAction>,
    /// Each action in Mailgun syntax, e.g. `forward("http://...")`.
    pub action_expressions: Vec<String>,
    pub created_at: String,
}

/// Body of `POST /api/v1/inbound-routes/test`: a filter to try on recent incoming emails.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct InboundRouteTestRequest {
    pub filter: InboundRouteFilter,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct InboundRouteMatch {
    pub email_id: String,
    pub from: String,
    /// The recipient or header value that matched.
    pub matched_value: String,
    pub subject: String,
    /// Named groups, usable in actions as `\g<name>`.
    pub captured_groups: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct InboundRouteTestResult {
    /// How many recent incoming emails were checked (at most 50).
    pub checked_count: usize,
    pub matches: Vec<InboundRouteMatch>,
}
