use sendmock_store::{WebhookDeliveryRecord, WebhookEndpointRecord};
use serde_json::{Map, Value};

use super::delivery_request_plan::DeliveryRequestPlan;
use super::delivery_request_rendering::{RenderedDeliveryRequest, render_delivery_request};
use super::delivery_template_context::DeliveryContextDetails;
use super::endpoint_settings::RetryPolicy;
use super::request_part_renderer::RenderProblemSeverity;
use crate::{AppEvent, OperationContext, OperationError};

/// Why a delivery was made.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryTrigger {
    /// A rule matched an event.
    Automatic,
    /// Sent by hand: Send test, Send to webhook, the composer.
    Manual,
    Replay,
}

impl DeliveryTrigger {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Automatic => "auto",
            Self::Manual => "manual",
            Self::Replay => "replay",
        }
    }
}

/// What a delivery carries and why it was made.
#[derive(Debug, Clone, PartialEq)]
pub struct DeliveryOrder {
    pub app_event: AppEvent,
    /// The email or SMS that caused the event.
    pub subject_id: Option<String>,
    pub rule_id: Option<String>,
    pub delivery_trigger: DeliveryTrigger,
    /// Values typed for this send (`vars.<name>`); empty for automatic deliveries.
    pub send_time_values: Map<String, Value>,
}

fn write_json(value: &impl serde::Serialize) -> Result<String, OperationError> {
    serde_json::to_string(value)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

fn log_render_warnings(
    stored_endpoint: &WebhookEndpointRecord,
    delivery_id: &str,
    rendered_delivery: &RenderedDeliveryRequest,
) {
    let warning_text = rendered_delivery.describe_problems(RenderProblemSeverity::Warning);
    if !warning_text.is_empty() {
        tracing::warn!(
            endpoint = %stored_endpoint.name,
            delivery_id = %delivery_id,
            warnings = %warning_text,
            "webhook request rendered with warnings"
        );
    }
}

/// The first attempt: `pending` and due now, or `render_failed` with the render errors.
pub fn build_first_attempt(
    stored_endpoint: &WebhookEndpointRecord,
    delivery_order: DeliveryOrder,
    delivery_id: String,
    retry_policy: &RetryPolicy,
    rendered_delivery: &RenderedDeliveryRequest,
    now_unix_ms: i64,
) -> Result<WebhookDeliveryRecord, OperationError> {
    let has_render_errors = rendered_delivery.has_errors();
    Ok(WebhookDeliveryRecord {
        delivery_id,
        endpoint_id: stored_endpoint.endpoint_id.clone(),
        endpoint_name: stored_endpoint.name.clone(),
        rule_id: delivery_order.rule_id,
        event_json: Some(write_json(&delivery_order.app_event)?),
        event_id: delivery_order.app_event.id,
        event_type: delivery_order.app_event.event_type,
        subject_id: delivery_order.subject_id,
        trigger: delivery_order.delivery_trigger.as_str().to_owned(),
        attempt: 1,
        status: if has_render_errors {
            "render_failed"
        } else {
            "pending"
        }
        .to_owned(),
        retry_policy_json: write_json(retry_policy)?,
        rendered_request_json: if has_render_errors {
            None
        } else {
            Some(write_json(&rendered_delivery.request)?)
        },
        sent_request_json: None,
        response_json: None,
        duration_ms: None,
        error_message: has_render_errors
            .then(|| rendered_delivery.describe_problems(RenderProblemSeverity::Error)),
        next_attempt_at_unix_ms: (!has_render_errors).then_some(now_unix_ms),
        created_at_unix_ms: now_unix_ms,
    })
}

/// Renders the planned request for one event, with the edited body in place when there is one.
pub async fn render_planned_delivery(
    operation_context: &OperationContext,
    stored_endpoint: &WebhookEndpointRecord,
    delivery_order: &DeliveryOrder,
    request_plan: &DeliveryRequestPlan,
    delivery_id: &str,
) -> Result<RenderedDeliveryRequest, OperationError> {
    let request_id = operation_context.id_generator.generate_id().to_string();
    let mut rendered_delivery = render_delivery_request(
        operation_context,
        &DeliveryContextDetails {
            app_event: &delivery_order.app_event,
            endpoint_id: Some(&stored_endpoint.endpoint_id),
            endpoint_name: &stored_endpoint.name,
            endpoint_url: &request_plan.url_template,
            delivery_id,
            delivery_trigger: delivery_order.delivery_trigger,
            rule_id: delivery_order.rule_id.as_deref(),
            request_id: &request_id,
            send_time_values: &delivery_order.send_time_values,
        },
        &request_plan.request_settings,
        request_plan.detached_template.as_ref(),
    )
    .await?;
    request_plan.apply_edited_body(&mut rendered_delivery);
    log_render_warnings(stored_endpoint, delivery_id, &rendered_delivery);
    Ok(rendered_delivery)
}

/// Stores a first attempt and wakes the dispatcher when it is due.
pub async fn queue_first_attempt(
    operation_context: &OperationContext,
    new_delivery: WebhookDeliveryRecord,
) -> Result<WebhookDeliveryRecord, OperationError> {
    operation_context
        .webhook_delivery_repository
        .insert_delivery(new_delivery.clone())
        .await?;
    if new_delivery.status == "pending" {
        operation_context.webhook_dispatch_signal.notify_one();
    }
    Ok(new_delivery)
}

/// Renders the planned request and builds its first attempt, not stored yet.
pub async fn build_planned_attempt(
    operation_context: &OperationContext,
    stored_endpoint: &WebhookEndpointRecord,
    delivery_order: DeliveryOrder,
    request_plan: &DeliveryRequestPlan,
) -> Result<WebhookDeliveryRecord, OperationError> {
    let delivery_id = operation_context.id_generator.generate_id().to_string();
    let rendered_delivery = render_planned_delivery(
        operation_context,
        stored_endpoint,
        &delivery_order,
        request_plan,
        &delivery_id,
    )
    .await?;
    build_first_attempt(
        stored_endpoint,
        delivery_order,
        delivery_id,
        &request_plan.request_settings.retry_policy,
        &rendered_delivery,
        operation_context.clock.now_unix_ms(),
    )
}

/// Renders the request and queues the first attempt, due at once, waking the dispatcher.
/// Never waits for the send, so ingest stays fast (WH-03.1). A strict render error stores the
/// delivery as `render_failed`, which is never sent or retried (WH-07.5); retries send the
/// request rendered here, so per-send random values stay the same (WH-07.4).
pub async fn enqueue_webhook_delivery(
    operation_context: &OperationContext,
    stored_endpoint: &WebhookEndpointRecord,
    delivery_order: DeliveryOrder,
) -> Result<WebhookDeliveryRecord, OperationError> {
    let request_plan = DeliveryRequestPlan::from_endpoint(stored_endpoint)?;
    let new_delivery = build_planned_attempt(
        operation_context,
        stored_endpoint,
        delivery_order,
        &request_plan,
    )
    .await?;
    queue_first_attempt(operation_context, new_delivery).await
}
