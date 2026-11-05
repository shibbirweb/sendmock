use sendmock_core::format_rfc3339;
use sendmock_mail::RoutableEmail;
use sendmock_store::{EmailRecord, InboundRouteRecord};

use super::route_expressions::{to_action_expression, to_route_expression};
use super::route_wire::{InboundRoute, InboundRouteAction, InboundRouteFilter};
use crate::{OperationContext, OperationError};

fn read_stored_json<Stored: serde::de::DeserializeOwned>(
    stored_json: &str,
) -> Result<Stored, OperationError> {
    serde_json::from_str(stored_json)
        .map_err(|read_error| OperationError::Internal(read_error.to_string()))
}

pub fn read_route_filter(
    route_record: &InboundRouteRecord,
) -> Result<InboundRouteFilter, OperationError> {
    read_stored_json(&route_record.filter_json)
}

pub fn read_route_actions(
    route_record: &InboundRouteRecord,
) -> Result<Vec<InboundRouteAction>, OperationError> {
    read_stored_json(&route_record.actions_json)
}

/// A stored route with its filter and actions in Mailgun syntax.
pub fn present_inbound_route(
    route_record: &InboundRouteRecord,
) -> Result<InboundRoute, OperationError> {
    let filter = read_route_filter(route_record)?;
    let actions = read_route_actions(route_record)?;
    Ok(InboundRoute {
        id: route_record.route_id.clone(),
        priority: route_record.priority,
        description: route_record.description.clone(),
        expression: to_route_expression(&filter),
        action_expressions: actions.iter().map(to_action_expression).collect(),
        filter,
        actions,
        created_at: format_rfc3339(route_record.created_at_unix_ms),
    })
}

pub fn build_route_record(
    route_id: String,
    priority: i64,
    description: &str,
    route_filter: &InboundRouteFilter,
    route_actions: &[InboundRouteAction],
    created_at_unix_ms: i64,
) -> Result<InboundRouteRecord, OperationError> {
    Ok(InboundRouteRecord {
        route_id,
        priority,
        description: description.trim().to_owned(),
        filter_json: serde_json::to_string(route_filter)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?,
        actions_json: serde_json::to_string(route_actions)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?,
        created_at_unix_ms,
    })
}

pub async fn find_route_or_not_found(
    operation_context: &OperationContext,
    route_id: &str,
) -> Result<InboundRouteRecord, OperationError> {
    operation_context
        .email_stores
        .inbound_routes
        .find_route(route_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No route with id {route_id}"),
        })
}

/// Recipients and headers of an email as a route filter reads them; `Subject` and `From`
/// fall back to the parsed values.
pub fn to_routable_email(stored_email: &EmailRecord) -> RoutableEmail {
    let mut headers = stored_email.headers.clone();
    headers
        .entry("Subject".to_owned())
        .or_insert_with(|| vec![stored_email.subject.clone()]);
    headers
        .entry("From".to_owned())
        .or_insert_with(|| vec![stored_email.from.address.clone()]);
    RoutableEmail {
        recipients: stored_email
            .to
            .iter()
            .chain(&stored_email.cc)
            .map(|recipient| recipient.address.clone())
            .collect(),
        headers,
    }
}
