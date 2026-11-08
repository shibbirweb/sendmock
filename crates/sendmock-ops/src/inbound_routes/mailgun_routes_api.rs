//! Mailgun's Routes API (`/v3/routes`) and stored messages (`/v3/domains/<domain>/messages/
//! <key>`) on the provider port, backed by the same routes the UI edits (WH-12.5, WH-12.6).

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sendmock_core::format_rfc5322;
use sendmock_store::InboundRouteRecord;
use serde_json::{Value, json};

use super::route_expression_parser::{parse_route_action, parse_route_expression};
use super::route_records::{
    build_route_record, find_route_or_not_found, present_inbound_route, read_route_actions,
    read_route_filter,
};
use super::route_validation::check_inbound_route;
use super::route_wire::{InboundRouteAction, InboundRouteFilter};
use super::stored_message_answer::answer_stored_message;
use crate::providers::{
    ProviderHttpRequest, ProviderHttpResponse, ProviderOutcome, ProviderRoute,
    read_provider_form_fields,
};
use crate::{OperationContext, OperationError};

const MAILGUN_PROVIDER_KEY: &str = "mailgun";
const ROUTES_PATH: &str = "/v3/routes";

pub(super) fn mailgun_json(status: u16, body: &Value) -> ProviderHttpResponse {
    ProviderHttpResponse {
        status,
        headers: vec![("Content-Type".to_owned(), "application/json".to_owned())],
        body: body.to_string(),
    }
}

fn is_mailgun_api_path(path: &str) -> bool {
    path == ROUTES_PATH
        || path.starts_with("/v3/routes/")
        || (path.starts_with("/v3/domains/") && path.contains("/messages/"))
}

/// The API key Mailgun SDKs send as the Basic password, masked in the request log.
fn read_api_key(request: &ProviderHttpRequest) -> Option<String> {
    let basic_login = request.header("authorization")?.strip_prefix("Basic ")?;
    let decoded_login = STANDARD.decode(basic_login.trim()).ok()?;
    let login_text = String::from_utf8_lossy(&decoded_login).into_owned();
    login_text
        .split_once(':')
        .map(|(_, api_key)| api_key.to_owned())
}

/// Mailgun's answer for a route API path, or `None` for any other request.
pub async fn answer_mailgun_routes_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    let is_mailgun_route = matches!(
        provider_route,
        ProviderRoute::Prefixed(MAILGUN_PROVIDER_KEY) | ProviderRoute::ProviderPort
    );
    if !is_mailgun_route || !is_mailgun_api_path(&request.path) {
        return Ok(None);
    }
    let response = if request.path.starts_with("/v3/domains/") {
        answer_stored_message(operation_context, request).await?
    } else {
        answer_routes_request(operation_context, request).await?
    };
    Ok(Some(ProviderOutcome {
        response,
        provider_key: Some(MAILGUN_PROVIDER_KEY.to_owned()),
        created_message: None,
        secret_values: read_api_key(request).into_iter().collect(),
    }))
}

async fn answer_routes_request(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
) -> Result<ProviderHttpResponse, OperationError> {
    let route_id = request.path.strip_prefix("/v3/routes/").map(str::to_owned);
    let method = request.method.to_ascii_uppercase();
    match (method.as_str(), route_id) {
        ("GET", None) => list_routes(operation_context, request).await,
        ("POST", None) => create_route(operation_context, request).await,
        ("GET", Some(route_id)) => {
            match find_route_or_not_found(operation_context, &route_id).await {
                Ok(stored_route) => Ok(mailgun_json(
                    200,
                    &json!({ "route": describe_route(&stored_route)? }),
                )),
                Err(_) => Ok(route_not_found()),
            }
        }
        ("PUT", Some(route_id)) => update_route(operation_context, request, &route_id).await,
        ("DELETE", Some(route_id)) => {
            let was_deleted = operation_context
                .email_stores
                .inbound_routes
                .delete_route(&route_id)
                .await?;
            Ok(if was_deleted {
                mailgun_json(
                    200,
                    &json!({ "message": "Route has been deleted", "id": route_id }),
                )
            } else {
                route_not_found()
            })
        }
        _ => Ok(mailgun_json(
            405,
            &json!({ "message": "Method not allowed" }),
        )),
    }
}

fn route_not_found() -> ProviderHttpResponse {
    mailgun_json(404, &json!({ "message": "Route not found" }))
}

/// A route as Mailgun's API answers it.
fn describe_route(stored_route: &InboundRouteRecord) -> Result<Value, OperationError> {
    let inbound_route = present_inbound_route(stored_route)?;
    Ok(json!({
        "id": inbound_route.id,
        "priority": inbound_route.priority,
        "description": inbound_route.description,
        "expression": inbound_route.expression,
        "actions": inbound_route.action_expressions,
        "created_at": format_rfc5322(stored_route.created_at_unix_ms).replace(" +0000", " GMT"),
    }))
}

async fn list_routes(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
) -> Result<ProviderHttpResponse, OperationError> {
    let query_fields: Vec<(String, String)> =
        serde_urlencoded::from_str(request.query_string.as_deref().unwrap_or_default())
            .unwrap_or_default();
    let read_number = |field_name: &str, default_value: usize| {
        query_fields
            .iter()
            .find(|(query_name, _)| query_name == field_name)
            .and_then(|(_, query_value)| query_value.parse().ok())
            .unwrap_or(default_value)
    };
    let stored_routes = operation_context
        .email_stores
        .inbound_routes
        .list_routes()
        .await?;
    let items = stored_routes
        .iter()
        .skip(read_number("skip", 0))
        .take(read_number("limit", 100))
        .map(describe_route)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(mailgun_json(
        200,
        &json!({ "total_count": stored_routes.len(), "items": items }),
    ))
}

/// The route fields of a form: `priority`, `description`, `expression` and each `action`.
struct RouteForm {
    priority: Option<i64>,
    description: Option<String>,
    expression: Option<String>,
    actions: Vec<String>,
}

fn read_route_form(request: &ProviderHttpRequest) -> RouteForm {
    let form_fields = read_provider_form_fields(request);
    let read_field = |field_name: &str| {
        form_fields
            .iter()
            .find(|(form_name, _)| form_name == field_name)
            .map(|(_, form_value)| form_value.clone())
    };
    RouteForm {
        priority: read_field("priority")
            .and_then(|priority_text| priority_text.trim().parse().ok()),
        description: read_field("description"),
        expression: read_field("expression"),
        actions: form_fields
            .iter()
            .filter(|(form_name, _)| form_name == "action" || form_name == "action[]")
            .map(|(_, form_value)| form_value.clone())
            .collect(),
    }
}

/// A route's parts: the form's values over the stored route's.
struct RouteParts {
    priority: i64,
    description: String,
    filter: InboundRouteFilter,
    actions: Vec<InboundRouteAction>,
}

/// The form read over the stored route, or why Mailgun would refuse it.
fn resolve_route_parts(
    route_form: RouteForm,
    stored_route: Option<&InboundRouteRecord>,
) -> Result<Result<RouteParts, &'static str>, OperationError> {
    let current_filter = stored_route.map(read_route_filter).transpose()?;
    let current_actions = stored_route.map(read_route_actions).transpose()?;
    let filter = match (route_form.expression.as_deref(), current_filter) {
        (Some(expression), _) => match parse_route_expression(expression) {
            Some(filter) => filter,
            None => return Ok(Err("Invalid expression")),
        },
        (None, Some(current_filter)) => current_filter,
        (None, None) => return Ok(Err("expression is required")),
    };
    let actions = if route_form.actions.is_empty() {
        current_actions.unwrap_or_default()
    } else {
        match route_form
            .actions
            .iter()
            .map(|action| parse_route_action(action))
            .collect()
        {
            Some(actions) => actions,
            None => return Ok(Err("Invalid action")),
        }
    };
    Ok(Ok(RouteParts {
        priority: route_form
            .priority
            .or(stored_route.map(|route| route.priority))
            .unwrap_or(0),
        description: route_form
            .description
            .or(stored_route.map(|route| route.description.clone()))
            .unwrap_or_default(),
        filter,
        actions,
    }))
}

/// The route the form describes, saved, or Mailgun's `400` saying what is wrong.
async fn save_route_form(
    operation_context: &OperationContext,
    route_form: RouteForm,
    stored_route: Option<InboundRouteRecord>,
) -> Result<Result<InboundRouteRecord, ProviderHttpResponse>, OperationError> {
    let refuse = |message: &str| Ok(Err(mailgun_json(400, &json!({ "message": message }))));
    let route_parts = match resolve_route_parts(route_form, stored_route.as_ref())? {
        Ok(route_parts) => route_parts,
        Err(message) => return refuse(message),
    };
    if let Err(OperationError::InvalidInput { message, .. }) = check_inbound_route(
        route_parts.priority,
        &route_parts.description,
        &route_parts.filter,
        &route_parts.actions,
    ) {
        return refuse(&message);
    }
    let (route_id, created_at_unix_ms) = match &stored_route {
        Some(stored_route) => (
            stored_route.route_id.clone(),
            stored_route.created_at_unix_ms,
        ),
        None => (
            operation_context.id_generator.generate_id().to_string(),
            operation_context.clock.now_unix_ms(),
        ),
    };
    let route_record = build_route_record(
        route_id,
        route_parts.priority,
        &route_parts.description,
        &route_parts.filter,
        &route_parts.actions,
        created_at_unix_ms,
    )?;
    operation_context
        .email_stores
        .inbound_routes
        .save_route(route_record.clone())
        .await?;
    Ok(Ok(route_record))
}

async fn create_route(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
) -> Result<ProviderHttpResponse, OperationError> {
    Ok(
        match save_route_form(operation_context, read_route_form(request), None).await? {
            Ok(route_record) => mailgun_json(
                200,
                &json!({ "message": "Route has been created", "route": describe_route(&route_record)? }),
            ),
            Err(refusal) => refusal,
        },
    )
}

async fn update_route(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
    route_id: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    let Ok(stored_route) = find_route_or_not_found(operation_context, route_id).await else {
        return Ok(route_not_found());
    };
    Ok(
        match save_route_form(
            operation_context,
            read_route_form(request),
            Some(stored_route),
        )
        .await?
        {
            Ok(route_record) => {
                let mut answer = describe_route(&route_record)?;
                answer["message"] = json!("Route has been updated");
                mailgun_json(200, &answer)
            }
            Err(refusal) => refusal,
        },
    )
}
