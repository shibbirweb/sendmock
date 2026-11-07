//! Runs the matching routes on each new incoming email, lowest priority first, until one
//! calls `stop()` (WH-12.1); each forward and store is logged on the email's timeline.

use sendmock_mail::{
    decompress_raw_message, fill_captured_groups, match_route_filter, parse_email,
};
use sendmock_store::{EmailRecord, InboundRouteRecord, TimelineRecord};

use super::route_delivery::queue_route_delivery;
use super::route_records::{read_route_actions, read_route_filter, to_routable_email};
use super::route_wire::InboundRouteAction;
use crate::email::{is_on_allowlist, release_email};
use crate::{AppEvent, OperationContext, OperationError};

/// What the routes need to know about the email, read once.
pub struct RoutedEmail {
    pub stored_email: EmailRecord,
    pub inbound_event: AppEvent,
    pub raw_message: Vec<u8>,
    pub attachments: Vec<sendmock_mail::ParsedAttachment>,
}

/// Runs the routes in a background task, so a slow app or relay never holds up the intake.
pub fn start_inbound_routes(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
    inbound_event: AppEvent,
) {
    let operation_context = operation_context.clone();
    let stored_email = stored_email.clone();
    tokio::spawn(async move {
        if let Err(route_error) =
            run_inbound_routes(&operation_context, stored_email, inbound_event).await
        {
            tracing::warn!(error = %route_error, "inbound routes failed");
        }
    });
}

async fn add_timeline_note(
    operation_context: &OperationContext,
    email_id: &str,
    kind: &str,
    detail: String,
) -> Result<(), OperationError> {
    operation_context
        .email_repository
        .add_timeline_entry(
            email_id,
            TimelineRecord {
                kind: kind.to_owned(),
                happened_at_unix_ms: operation_context.clock.now_unix_ms(),
                detail,
            },
        )
        .await?;
    Ok(())
}

async fn read_routed_email(
    operation_context: &OperationContext,
    stored_email: EmailRecord,
    inbound_event: AppEvent,
) -> Result<RoutedEmail, OperationError> {
    let compressed_raw_message = operation_context
        .email_repository
        .read_compressed_raw_message(&stored_email.email_id)
        .await?
        .unwrap_or_default();
    let raw_message = decompress_raw_message(&compressed_raw_message)
        .map_err(|decode_error| OperationError::Internal(decode_error.to_string()))?;
    let attachments = parse_email(&raw_message).attachments;
    Ok(RoutedEmail {
        stored_email,
        inbound_event,
        raw_message,
        attachments,
    })
}

pub async fn run_inbound_routes(
    operation_context: &OperationContext,
    stored_email: EmailRecord,
    inbound_event: AppEvent,
) -> Result<(), OperationError> {
    let stored_routes = operation_context
        .email_stores
        .inbound_routes
        .list_routes()
        .await?;
    if stored_routes.is_empty() {
        return Ok(());
    }
    let routable_email = to_routable_email(&stored_email);
    let routed_email = read_routed_email(operation_context, stored_email, inbound_event).await?;
    for stored_route in &stored_routes {
        let filter_rule = read_route_filter(stored_route)?.to_filter_rule();
        let Some(route_match) = match_route_filter(&filter_rule, &routable_email) else {
            continue;
        };
        let should_stop =
            run_route_actions(operation_context, &routed_email, stored_route, &route_match).await?;
        if should_stop {
            break;
        }
    }
    Ok(())
}

/// Runs one matched route's actions in order; answers whether it called `stop()`.
async fn run_route_actions(
    operation_context: &OperationContext,
    routed_email: &RoutedEmail,
    stored_route: &InboundRouteRecord,
    route_match: &sendmock_mail::RouteFilterMatch,
) -> Result<bool, OperationError> {
    let route_run = RouteRun {
        operation_context,
        routed_email,
        stored_route,
        route_match,
        route_name: if stored_route.description.is_empty() {
            "untitled route".to_owned()
        } else {
            stored_route.description.clone()
        },
    };
    let mut should_stop = false;
    for route_action in read_route_actions(stored_route)? {
        should_stop |= route_run.run_action(route_action).await?;
    }
    Ok(should_stop)
}

/// One matched route on one email.
struct RouteRun<'run> {
    operation_context: &'run OperationContext,
    routed_email: &'run RoutedEmail,
    stored_route: &'run InboundRouteRecord,
    route_match: &'run sendmock_mail::RouteFilterMatch,
    route_name: String,
}

impl RouteRun<'_> {
    async fn note(&self, kind: &str, detail: String) -> Result<(), OperationError> {
        add_timeline_note(
            self.operation_context,
            &self.routed_email.stored_email.email_id,
            kind,
            detail,
        )
        .await
    }

    async fn send_request(
        &self,
        target_url: &str,
        is_store_notification: bool,
    ) -> Result<(), OperationError> {
        queue_route_delivery(
            self.operation_context,
            self.routed_email,
            self.stored_route,
            target_url,
            self.route_match,
            is_store_notification,
        )
        .await
        .map(|_| ())
    }

    /// Answers whether the action was `stop()`.
    async fn run_action(&self, route_action: InboundRouteAction) -> Result<bool, OperationError> {
        let route_name = &self.route_name;
        let captured_groups = &self.route_match.captured_groups;
        match route_action {
            InboundRouteAction::Stop => return Ok(true),
            InboundRouteAction::ForwardEmail { address } => {
                let address = fill_captured_groups(&address, captured_groups);
                forward_to_address(
                    self.operation_context,
                    self.routed_email,
                    &address,
                    route_name,
                )
                .await?;
            }
            InboundRouteAction::ForwardUrl { url } => {
                let url = fill_captured_groups(&url, captured_groups);
                self.send_request(&url, false).await?;
                self.note(
                    "webhook_sent",
                    format!("Forwarded by route {route_name} to {url}"),
                )
                .await?;
            }
            InboundRouteAction::Store { notify_url } => {
                match notify_url.filter(|notify_url| !notify_url.is_empty()) {
                    Some(notify_url) => {
                        self.send_request(&notify_url, true).await?;
                        self.note(
                            "webhook_sent",
                            format!("Stored and notified by route {route_name} to {notify_url}"),
                        )
                        .await?;
                    }
                    None => {
                        self.note("webhook_sent", format!("Stored by route {route_name}"))
                            .await?
                    }
                }
            }
        }
        Ok(false)
    }
}

/// Sends a copy to a real address through the relay, only when the address is on the
/// release allowlist (WH-12.5).
async fn forward_to_address(
    operation_context: &OperationContext,
    routed_email: &RoutedEmail,
    address: &str,
    route_name: &str,
) -> Result<(), OperationError> {
    let app_settings = operation_context.settings_store.current().await?;
    let email_id = routed_email.stored_email.email_id.as_str();
    if !is_on_allowlist(&app_settings.relay_recipient_allowlist, address) {
        return add_timeline_note(
            operation_context,
            email_id,
            "forwarded",
            format!(
                "Not forwarded to {address}: not on the release allowlist (route {route_name})"
            ),
        )
        .await;
    }
    match release_email(
        operation_context,
        &routed_email.stored_email,
        &[address.to_owned()],
        &format!("route {route_name}"),
    )
    .await
    {
        Err(OperationError::Conflict { message, .. }) => {
            add_timeline_note(
                operation_context,
                email_id,
                "forwarded",
                format!("Not forwarded to {address}: {message}"),
            )
            .await
        }
        other_result => other_result.map(|_| ()),
    }
}
