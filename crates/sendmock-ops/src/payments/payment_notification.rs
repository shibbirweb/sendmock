use sendmock_core::format_rfc3339;
use sendmock_store::{WebhookDeliveryRecord, WebhookEndpointRecord};
use serde_json::Value;

use super::gateway_template_rendering::{
    GatewayPartRenderer, GatewayRenderOptions, RedirectOutcome, build_gateway_context,
};
use super::payment_catalogue::add_timeline_event;
use super::payment_gateway_preview_views::GatewayTemplateProblem;
use super::payment_gateway_views::PaymentGatewayFields;
use super::payment_views::{PaymentDetail, PaymentNotification};
use crate::webhooks::{
    DeliveryOrder, DeliveryTrigger, RenderProblem, RenderProblemSeverity, RenderedDeliveryRequest,
    enqueue_rendered_delivery,
};
use crate::{AppEvent, OperationContext, OperationError, RecordedHttpRequest};

/// Native notifications are signed with the endpoint's Standard Webhooks secret; every other
/// gateway signs with its own header templates, as the provider does.
const NATIVE_GATEWAY_KEY: &str = "native";

/// The gateway's notification for one event, ready to queue.
struct GatewayNotification {
    event_name: String,
    rendered_delivery: RenderedDeliveryRequest,
}

/// The redirect a notification describes: `redirect.status` reads the outcome's event name.
fn read_redirect_outcome(event_type: &str) -> RedirectOutcome {
    match event_type {
        "payment.failed" => RedirectOutcome::Fail,
        "payment.canceled" | "checkout.expired" => RedirectOutcome::Cancel,
        _ => RedirectOutcome::Success,
    }
}

fn to_render_problem(gateway_problem: GatewayTemplateProblem) -> RenderProblem {
    RenderProblem {
        message: gateway_problem.message,
        severity: if gateway_problem.severity == "error" {
            RenderProblemSeverity::Error
        } else {
            RenderProblemSeverity::Warning
        },
        source: gateway_problem.part,
        line: None,
        column: None,
    }
}

/// Renders the notification, or none when the gateway names no event for this one.
fn render_gateway_notification(
    operation_context: &OperationContext,
    gateway_fields: &PaymentGatewayFields,
    payment: &PaymentDetail,
    render_options: &GatewayRenderOptions,
    endpoint_url: &str,
) -> Option<GatewayNotification> {
    let event_name = gateway_fields
        .event_names
        .get(&render_options.event_type)
        .filter(|event_name| !event_name.trim().is_empty())?
        .clone();
    let template_context = build_gateway_context(gateway_fields, payment, render_options);
    let mut part_renderer = GatewayPartRenderer::new(
        operation_context,
        &template_context,
        render_options.timestamp_seconds,
    );
    let (headers, body) = part_renderer.render_notification(gateway_fields);
    Some(GatewayNotification {
        event_name,
        rendered_delivery: RenderedDeliveryRequest {
            request: RecordedHttpRequest {
                method: "POST".to_owned(),
                url: endpoint_url.to_owned(),
                headers,
                body,
            },
            problems: part_renderer
                .problems
                .into_iter()
                .map(to_render_problem)
                .collect(),
        },
    })
}

/// The gateway's enabled notification endpoint; none when it has none, or it was deleted.
async fn find_notification_endpoint(
    operation_context: &OperationContext,
    gateway_fields: &PaymentGatewayFields,
) -> Result<Option<WebhookEndpointRecord>, OperationError> {
    let Some(endpoint_id) = &gateway_fields.notification_endpoint_id else {
        return Ok(None);
    };
    let stored_endpoint = operation_context
        .webhook_endpoint_repository
        .find_endpoint(endpoint_id)
        .await?;
    Ok(stored_endpoint.filter(|stored_endpoint| stored_endpoint.is_enabled))
}

/// The event the notification stands for, carrying the payment's summary.
fn build_delivery_order(
    payment: &PaymentDetail,
    event_type: &str,
    event_id: String,
    now_unix_ms: i64,
) -> DeliveryOrder {
    DeliveryOrder {
        app_event: AppEvent {
            id: event_id,
            event_type: event_type.to_owned(),
            created_at: format_rfc3339(now_unix_ms),
            data: serde_json::to_value(&payment.summary).unwrap_or(Value::Null),
        },
        subject_id: Some(payment.summary.id.clone()),
        rule_id: None,
        delivery_trigger: DeliveryTrigger::Automatic,
        send_time_values: serde_json::Map::new(),
    }
}

/// Lists the queued notification on the payment and adds it to the timeline.
fn note_notification(
    operation_context: &OperationContext,
    payment: &mut PaymentDetail,
    queued_delivery: WebhookDeliveryRecord,
    provider_event_name: &str,
    endpoint_name: &str,
) {
    payment.notifications.push(PaymentNotification {
        delivery_id: queued_delivery.delivery_id,
        event_type: queued_delivery.event_type,
        provider_event_name: provider_event_name.to_owned(),
        status: queued_delivery.status,
        status_code: None,
        created_at: format_rfc3339(queued_delivery.created_at_unix_ms),
    });
    add_timeline_event(
        operation_context,
        payment,
        "notification_sent",
        format!("Sent {provider_event_name} to {endpoint_name}"),
    );
}

/// Queues the gateway's notification for one event to its notification endpoint as a
/// webhook delivery (so it is retried, logged and replayable) and notes it on the payment.
/// Nothing is queued when the gateway has no endpoint or names no event for this one.
pub async fn queue_payment_notification(
    operation_context: &OperationContext,
    gateway_fields: &PaymentGatewayFields,
    payment: &mut PaymentDetail,
    event_type: &str,
) -> Result<(), OperationError> {
    let Some(stored_endpoint) =
        find_notification_endpoint(operation_context, gateway_fields).await?
    else {
        return Ok(());
    };
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let render_options = GatewayRenderOptions {
        event_type: event_type.to_owned(),
        redirect_outcome: read_redirect_outcome(event_type),
        event_id: format!("evt_{}", operation_context.id_generator.generate_id()),
        timestamp_seconds: now_unix_ms.div_euclid(1_000),
        should_mask_secrets: false,
    };
    let Some(notification) = render_gateway_notification(
        operation_context,
        gateway_fields,
        payment,
        &render_options,
        &stored_endpoint.url,
    ) else {
        return Ok(());
    };
    let delivery_order =
        build_delivery_order(payment, event_type, render_options.event_id, now_unix_ms);
    let queued_delivery = enqueue_rendered_delivery(
        operation_context,
        &stored_endpoint,
        delivery_order,
        &notification.rendered_delivery,
        gateway_fields.key == NATIVE_GATEWAY_KEY,
    )
    .await?;
    note_notification(
        operation_context,
        payment,
        queued_delivery,
        &notification.event_name,
        &stored_endpoint.name,
    );
    Ok(())
}

fn read_response_status_code(delivery_attempt: &WebhookDeliveryRecord) -> Option<u16> {
    let response_json = delivery_attempt.response_json.as_deref()?;
    let response: Value = serde_json::from_str(response_json).ok()?;
    response["status_code"]
        .as_u64()
        .and_then(|status_code| u16::try_from(status_code).ok())
}

/// Each notification as its latest attempt stands now, so retries show on the payment.
pub async fn refresh_notification_statuses(
    operation_context: &OperationContext,
    payment: &mut PaymentDetail,
) -> Result<(), OperationError> {
    let delivery_repository = &operation_context.webhook_delivery_repository;
    for payment_notification in &mut payment.notifications {
        let Some(first_attempt) = delivery_repository
            .find_delivery(&payment_notification.delivery_id)
            .await?
        else {
            continue;
        };
        let latest_attempt = delivery_repository
            .list_event_attempts(&first_attempt.event_id, &first_attempt.endpoint_id)
            .await?
            .pop()
            .unwrap_or(first_attempt);
        payment_notification.status_code = read_response_status_code(&latest_attempt);
        payment_notification.status = latest_attempt.status;
    }
    Ok(())
}
