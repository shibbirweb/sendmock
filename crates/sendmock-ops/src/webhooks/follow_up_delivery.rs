//! A webhook a catcher rule sends after it answers (PL-21.4): rendered with any template, to a
//! URL or an endpoint, queued as a delivery so it is logged and retried like any other.

use sendmock_store::{WebhookDeliveryRecord, WebhookEndpointRecord};
use serde_json::Map;

use super::delivery_queue::{DeliveryTrigger, queue_first_attempt};
use super::delivery_request_rendering::{RenderedDeliveryRequest, render_delivery_request};
use super::delivery_template_context::DeliveryContextDetails;
use super::endpoint_settings::{EndpointRequestSettings, default_request_settings};
use super::endpoint_view::read_request_settings;
use super::request_part_renderer::RenderProblemSeverity;
use crate::{AppEvent, OperationContext, OperationError};

/// Where a follow-up goes.
pub enum FollowUpTarget {
    /// A saved endpoint: its URL, settings and retry policy.
    Endpoint(WebhookEndpointRecord),
    /// A URL rendered from the rule, under the name the delivery log shows.
    Url { url: String, target_name: String },
}

/// One follow-up to queue: the event it renders against, its template and its delay.
pub struct FollowUpOrder {
    pub app_event: AppEvent,
    pub target: FollowUpTarget,
    pub template_id: String,
    pub delay_ms: u32,
    /// The captured request it follows, which the delivery links to.
    pub subject_id: String,
    /// Stands in for the endpoint on a URL follow-up, so the delivery is grouped by its rule.
    pub rule_id: String,
}

fn write_json(value: &impl serde::Serialize) -> Result<String, OperationError> {
    serde_json::to_string(value)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

/// The endpoint's settings, or the defaults, rendering the chosen template's body.
fn build_request_settings(
    follow_up_order: &FollowUpOrder,
) -> Result<EndpointRequestSettings, OperationError> {
    let mut request_settings_json = match &follow_up_order.target {
        FollowUpTarget::Endpoint(stored_endpoint) => {
            serde_json::to_value(read_request_settings(stored_endpoint)?)
                .map_err(|write_error| OperationError::Internal(write_error.to_string()))?
        }
        // A vendor template reads fields its own events carry, which a captured request may
        // not have, so a missing one renders empty instead of failing the delivery.
        FollowUpTarget::Url { .. } => {
            let mut url_settings = default_request_settings();
            url_settings["render_mode"] = "lenient".into();
            url_settings
        }
    };
    request_settings_json["template_id"] = follow_up_order.template_id.clone().into();
    request_settings_json["template_mode"] = "linked".into();
    request_settings_json["body_mode"] = "template".into();
    serde_json::from_value(request_settings_json)
        .map_err(|read_error| OperationError::Internal(read_error.to_string()))
}

/// Renders the follow-up and queues it, due after its delay. A follow-up to an endpoint is
/// signed with the endpoint's secret only for the `native` template; a vendor template signs
/// itself, as the vendor would.
pub async fn queue_follow_up_delivery(
    operation_context: &OperationContext,
    follow_up_order: FollowUpOrder,
) -> Result<WebhookDeliveryRecord, OperationError> {
    let request_settings = build_request_settings(&follow_up_order)?;
    let (endpoint_id, endpoint_name, endpoint_url) = match &follow_up_order.target {
        FollowUpTarget::Endpoint(stored_endpoint) => (
            stored_endpoint.endpoint_id.clone(),
            stored_endpoint.name.clone(),
            stored_endpoint.url.clone(),
        ),
        FollowUpTarget::Url { url, target_name } => (
            follow_up_order.rule_id.clone(),
            target_name.clone(),
            url.clone(),
        ),
    };
    let is_saved_endpoint = matches!(follow_up_order.target, FollowUpTarget::Endpoint(_));
    let delivery_id = operation_context.id_generator.generate_id().to_string();
    let request_id = operation_context.id_generator.generate_id().to_string();
    let rendered_delivery = render_delivery_request(
        operation_context,
        &DeliveryContextDetails {
            app_event: &follow_up_order.app_event,
            endpoint_id: is_saved_endpoint.then_some(endpoint_id.as_str()),
            endpoint_name: &endpoint_name,
            endpoint_url: &endpoint_url,
            delivery_id: &delivery_id,
            delivery_trigger: DeliveryTrigger::Automatic,
            rule_id: None,
            request_id: &request_id,
            send_time_values: &Map::new(),
        },
        &request_settings,
        None,
        None,
    )
    .await?;
    let follow_up_delivery = build_follow_up_record(
        operation_context,
        &follow_up_order,
        FollowUpRecordParts {
            delivery_id,
            endpoint_id,
            endpoint_name,
            retry_policy_json: write_json(&request_settings.retry_policy)?,
            rendered_delivery,
            is_signed: is_saved_endpoint && follow_up_order.template_id == "native",
        },
    )?;
    queue_first_attempt(operation_context, follow_up_delivery).await
}

/// What the record takes from the render and the target.
struct FollowUpRecordParts {
    delivery_id: String,
    endpoint_id: String,
    endpoint_name: String,
    retry_policy_json: String,
    rendered_delivery: RenderedDeliveryRequest,
    is_signed: bool,
}

/// The first attempt, due after the delay, or `render_failed` with the render errors.
fn build_follow_up_record(
    operation_context: &OperationContext,
    follow_up_order: &FollowUpOrder,
    record_parts: FollowUpRecordParts,
) -> Result<WebhookDeliveryRecord, OperationError> {
    let FollowUpRecordParts {
        delivery_id,
        endpoint_id,
        endpoint_name,
        retry_policy_json,
        rendered_delivery,
        is_signed,
    } = record_parts;
    let has_render_errors = rendered_delivery.has_errors();
    let now_unix_ms = operation_context.clock.now_unix_ms();
    Ok(WebhookDeliveryRecord {
        delivery_id,
        endpoint_id,
        endpoint_name,
        rule_id: None,
        event_json: Some(write_json(&follow_up_order.app_event)?),
        event_id: follow_up_order.app_event.id.clone(),
        event_type: follow_up_order.app_event.event_type.clone(),
        subject_id: Some(follow_up_order.subject_id.clone()),
        trigger: DeliveryTrigger::Automatic.as_str().to_owned(),
        attempt: 1,
        status: if has_render_errors {
            "render_failed"
        } else {
            "pending"
        }
        .to_owned(),
        retry_policy_json,
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
        next_attempt_at_unix_ms: (!has_render_errors)
            .then_some(now_unix_ms + i64::from(follow_up_order.delay_ms)),
        created_at_unix_ms: now_unix_ms,
        is_signed,
        is_edited: false,
    })
}
