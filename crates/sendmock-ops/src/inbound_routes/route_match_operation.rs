use std::collections::BTreeMap;

use sendmock_mail::{RoutableEmail, fill_captured_groups};
use sendmock_webhooks::RuleMessage;

use super::route_expressions::{to_action_expression, to_route_expression};
use super::route_match_wire::{
    InboundRouteMatchRequest, InboundRouteMatchResult, MatchedInboundRoute, MatchedWebhookRule,
};
use super::route_records::read_route_filter;
use super::route_selection::{SelectedRoute, select_matching_routes};
use super::route_wire::InboundRouteAction;
use crate::email::read_bare_address;
use crate::webhooks::find_firing_rules;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

/// The event an incoming email fires, which the previewed rules listen to.
const INBOUND_EVENT_TYPE: &str = "email.inbound";
/// Replies and forwards are stored in the default project.
const INCOMING_PROJECT_KEY: &str = "default";

pub struct MatchInboundRoutesOperation;

impl Operation for MatchInboundRoutesOperation {
    type Input = InboundRouteMatchRequest;
    type Output = InboundRouteMatchResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postInboundRoutesMatch",
            method: HttpMethod::Post,
            path: "/api/v1/inbound-routes/match",
            summary: "Where an incoming email would go: the routes and webhook rules it would run.",
            is_read_only: true,
            cli_usage: "sendmock route match",
            mcp_tool: "sendmock_inbound_route_match",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The same route and rule matching a real incoming email runs, with nothing stored or
    /// sent (EM-22.2).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: InboundRouteMatchRequest,
    ) -> Result<InboundRouteMatchResult, OperationError> {
        let incoming_email = IncomingEmailPreview::from_request(input);
        let stored_routes = operation_context
            .email_stores
            .inbound_routes
            .list_routes()
            .await?;
        let routes = select_matching_routes(&stored_routes, &incoming_email.to_routable_email())?
            .into_iter()
            .map(present_matched_route)
            .collect::<Result<_, _>>()?;
        let stored_rules = operation_context
            .webhook_rule_repository
            .list_rules()
            .await?;
        let webhook_rules = find_firing_rules(
            operation_context,
            stored_rules,
            INBOUND_EVENT_TYPE,
            &incoming_email.to_rule_message(),
        )
        .await?
        .into_iter()
        .map(|(stored_rule, stored_endpoint)| MatchedWebhookRule {
            rule_id: stored_rule.rule_id,
            rule_name: stored_rule.name,
            endpoint_id: stored_endpoint.endpoint_id,
            endpoint_name: stored_endpoint.name,
            endpoint_url: stored_endpoint.url,
        })
        .collect();
        Ok(InboundRouteMatchResult {
            routes,
            webhook_rules,
        })
    }
}

/// The recipients and headers of an email that has not arrived yet.
struct IncomingEmailPreview {
    to_addresses: Vec<String>,
    cc_addresses: Vec<String>,
    headers: BTreeMap<String, Vec<String>>,
}

impl IncomingEmailPreview {
    fn from_request(input: InboundRouteMatchRequest) -> Self {
        let read_addresses = |addresses: Vec<String>| {
            addresses
                .iter()
                .map(|address| read_bare_address(address))
                .filter(|address| !address.is_empty())
                .collect::<Vec<_>>()
        };
        Self {
            to_addresses: read_addresses(input.to),
            cc_addresses: read_addresses(input.cc.unwrap_or_default()),
            headers: input
                .headers
                .unwrap_or_default()
                .into_iter()
                .map(|(header_name, header_value)| (header_name, vec![header_value]))
                .collect(),
        }
    }

    fn read_header(&self, header_name: &str) -> Option<String> {
        self.headers
            .iter()
            .find(|(candidate_name, _)| candidate_name.eq_ignore_ascii_case(header_name))
            .and_then(|(_, header_values)| header_values.first().cloned())
    }

    fn to_routable_email(&self) -> RoutableEmail {
        RoutableEmail {
            recipients: self
                .to_addresses
                .iter()
                .chain(&self.cc_addresses)
                .cloned()
                .collect(),
            headers: self.headers.clone(),
        }
    }

    /// The fields a rule filter reads from a stored email; the body is not known yet.
    fn to_rule_message(&self) -> RuleMessage {
        let from_address = self
            .read_header("from")
            .map(|from_text| read_bare_address(&from_text))
            .unwrap_or_default();
        RuleMessage::default()
            .with_field("from", vec![from_address])
            .with_field("to", self.to_addresses.clone())
            .with_field("cc", self.cc_addresses.clone())
            .with_field(
                "subject",
                vec![self.read_header("subject").unwrap_or_default()],
            )
            .with_field("body", vec![String::new()])
            .with_field("has_attachment", vec![false.to_string()])
            .with_field("tag", Vec::new())
            .with_field("open_count", vec![0.to_string()])
            .with_field("first_open", vec![false.to_string()])
            .with_field("project", vec![INCOMING_PROJECT_KEY.to_owned()])
            .with_headers(self.headers.clone())
    }
}

/// Named groups filled in, as the runner fills them when the email arrives.
fn fill_action_groups(
    route_action: &InboundRouteAction,
    captured_groups: &BTreeMap<String, String>,
) -> InboundRouteAction {
    match route_action {
        InboundRouteAction::ForwardUrl { url } => InboundRouteAction::ForwardUrl {
            url: fill_captured_groups(url, captured_groups),
        },
        InboundRouteAction::ForwardEmail { address } => InboundRouteAction::ForwardEmail {
            address: fill_captured_groups(address, captured_groups),
        },
        InboundRouteAction::Store { notify_url } => InboundRouteAction::Store {
            notify_url: notify_url
                .as_deref()
                .map(|notify_url| fill_captured_groups(notify_url, captured_groups)),
        },
        InboundRouteAction::Stop => InboundRouteAction::Stop,
    }
}

fn present_matched_route(
    selected_route: SelectedRoute<'_>,
) -> Result<MatchedInboundRoute, OperationError> {
    let stored_route = selected_route.stored_route;
    let calls_stop = selected_route.calls_stop();
    let captured_groups = &selected_route.route_match.captured_groups;
    let actions: Vec<InboundRouteAction> = selected_route
        .route_actions
        .iter()
        .map(|route_action| fill_action_groups(route_action, captured_groups))
        .collect();
    Ok(MatchedInboundRoute {
        route_id: stored_route.route_id.clone(),
        priority: stored_route.priority,
        description: stored_route.description.clone(),
        expression: to_route_expression(&read_route_filter(stored_route)?),
        matched_value: selected_route.route_match.matched_value.clone(),
        action_expressions: actions.iter().map(to_action_expression).collect(),
        actions,
        calls_stop,
    })
}
