use std::collections::BTreeMap;

use schemars::JsonSchema;
use sendmock_store::{WebhookDeliveryRecord, WebhookEndpointRecord};
use serde::Deserialize;

use super::delivery_detail::find_delivery_or_not_found;
use super::delivery_queue::{
    DeliveryOrder, DeliveryTrigger, build_first_attempt, queue_first_attempt,
    render_planned_delivery,
};
use super::delivery_request_plan::DeliveryRequestPlan;
use super::delivery_request_rendering::RenderedDeliveryRequest;
use super::delivery_view::WebhookDelivery;
use super::endpoint_operations::find_stored_endpoint;
use super::endpoint_settings::RetryPolicy;
use super::endpoint_test_operation::{TEST_EVENT_TYPE, build_test_plan};
use crate::{
    AppEvent, HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
    RecordedHttpRequest,
};

/// The headers the sender adds to every attempt; an edited copy of a sent request carries the
/// old ones, which would sign nothing.
const SIGNATURE_HEADER_NAMES: [&str; 4] = [
    "webhook-id",
    "webhook-timestamp",
    "webhook-signature",
    "webhook-attempt",
];

/// `POST /api/v1/webhooks/deliveries/{deliveryId}/replay` (WH-05.2).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct DeliveryReplayRequest {
    /// The delivery's ID, from `GET /api/v1/webhooks/deliveries`.
    pub delivery_id: String,
    /// Renders the request again with today's template and variables; false resends the stored request as it was.
    pub rerender: bool,
    /// An edited body and headers; left out to resend the stored request.
    pub body: Option<String>,
    /// Edited headers, by name; left out to resend the stored ones.
    pub headers: Option<BTreeMap<String, String>>,
}

fn conflict(code: &'static str, message: String) -> OperationError {
    OperationError::Conflict { code, message }
}

fn parse_json<Parsed: serde::de::DeserializeOwned>(
    stored_json: &str,
) -> Result<Parsed, OperationError> {
    serde_json::from_str(stored_json)
        .map_err(|parse_error| OperationError::Internal(parse_error.to_string()))
}

/// The stored request as it was rendered, before signing, with the retry policy it was
/// queued with.
fn read_stored_request(
    original_delivery: &WebhookDeliveryRecord,
) -> Result<(RenderedDeliveryRequest, RetryPolicy), OperationError> {
    let Some(rendered_request_json) = &original_delivery.rendered_request_json else {
        return Err(conflict(
            "nothing_to_replay",
            "This delivery was never sent: its template failed to render.".to_owned(),
        ));
    };
    let stored_request = RenderedDeliveryRequest {
        request: parse_json::<RecordedHttpRequest>(rendered_request_json)?,
        problems: Vec::new(),
    };
    Ok((
        stored_request,
        parse_json(&original_delivery.retry_policy_json)?,
    ))
}

struct ReplayedEvent {
    app_event: AppEvent,
    /// Rows queued before events were kept: only the id and type are known.
    event_json_is_missing: bool,
}

/// The original event under a new id, so the replay is its own message with its own attempts.
fn read_replayed_event(
    original_delivery: &WebhookDeliveryRecord,
    replay_event_id: String,
) -> Result<ReplayedEvent, OperationError> {
    let Some(event_json) = &original_delivery.event_json else {
        return Ok(ReplayedEvent {
            app_event: AppEvent {
                id: replay_event_id,
                event_type: original_delivery.event_type.clone(),
                created_at: sendmock_core::format_rfc3339(original_delivery.created_at_unix_ms),
                data: serde_json::Value::Null,
            },
            event_json_is_missing: true,
        });
    };
    let original_event: AppEvent = parse_json(event_json)?;
    Ok(ReplayedEvent {
        app_event: AppEvent {
            id: replay_event_id,
            ..original_event
        },
        event_json_is_missing: false,
    })
}

/// The event's request rendered again with the endpoint's settings and variables as they are
/// now; a `test.ping` keeps its fixed test body.
async fn render_replay_again(
    operation_context: &OperationContext,
    stored_endpoint: &WebhookEndpointRecord,
    replay_order: &DeliveryOrder,
    delivery_id: &str,
) -> Result<(RenderedDeliveryRequest, RetryPolicy), OperationError> {
    let request_plan = if replay_order.app_event.event_type == TEST_EVENT_TYPE {
        build_test_plan(stored_endpoint, &replay_order.app_event)?
    } else {
        DeliveryRequestPlan::from_endpoint(stored_endpoint)?
    };
    let rendered_delivery = render_planned_delivery(
        operation_context,
        stored_endpoint,
        replay_order,
        &request_plan,
        delivery_id,
    )
    .await?;
    Ok((
        rendered_delivery,
        request_plan.request_settings.retry_policy,
    ))
}

/// Puts the edited body and headers in place; the sender signs the replay afresh.
fn apply_replay_edits(
    rendered_delivery: &mut RenderedDeliveryRequest,
    input: DeliveryReplayRequest,
) {
    if let Some(edited_body) = input.body {
        rendered_delivery.request.body = edited_body;
    }
    if let Some(edited_headers) = input.headers {
        rendered_delivery.request.headers = edited_headers
            .into_iter()
            .filter(|(header_name, _)| {
                !SIGNATURE_HEADER_NAMES.contains(&header_name.to_ascii_lowercase().as_str())
            })
            .collect();
    }
}

pub struct ReplayWebhookDeliveryOperation;

impl Operation for ReplayWebhookDeliveryOperation {
    type Input = DeliveryReplayRequest;
    type Output = WebhookDelivery;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksDeliveriesByDeliveryIdReplay",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/deliveries/{deliveryId}/replay",
            summary: "Send the delivery again, as it was or edited.",
            cli_usage: "sendmock webhook deliveries replay <deliveryId>",
            mcp_tool: "sendmock_webhook_delivery_replay",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Queues a `replay` delivery to the same endpoint (WH-05.2): the stored request as it
    /// was, or rendered again, with an edited body and headers sent as written.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: DeliveryReplayRequest,
    ) -> Result<WebhookDelivery, OperationError> {
        let original_delivery =
            find_delivery_or_not_found(operation_context, &input.delivery_id).await?;
        let stored_endpoint =
            find_stored_endpoint(operation_context, &original_delivery.endpoint_id).await?;
        let replay_event_id = format!("evt_{}", operation_context.id_generator.generate_id());
        let replayed_event = read_replayed_event(&original_delivery, replay_event_id)?;
        if input.rerender && replayed_event.event_json_is_missing {
            return Err(conflict(
                "nothing_to_rerender",
                "This delivery was queued before events were kept; replay it as it was instead."
                    .to_owned(),
            ));
        }
        let replay_order = DeliveryOrder {
            app_event: replayed_event.app_event,
            subject_id: original_delivery.subject_id.clone(),
            rule_id: original_delivery.rule_id.clone(),
            delivery_trigger: DeliveryTrigger::Replay,
            send_time_values: serde_json::Map::new(),
        };
        let delivery_id = operation_context.id_generator.generate_id().to_string();
        let (mut rendered_delivery, retry_policy) = if input.rerender {
            render_replay_again(
                operation_context,
                &stored_endpoint,
                &replay_order,
                &delivery_id,
            )
            .await?
        } else {
            read_stored_request(&original_delivery)?
        };
        apply_replay_edits(&mut rendered_delivery, input);
        let mut replay_delivery = build_first_attempt(
            &stored_endpoint,
            replay_order,
            delivery_id,
            &retry_policy,
            &rendered_delivery,
            operation_context.clock.now_unix_ms(),
        )?;
        if replayed_event.event_json_is_missing {
            replay_delivery.event_json = None;
        }
        let queued_delivery = queue_first_attempt(operation_context, replay_delivery).await?;
        Ok(WebhookDelivery::from(queued_delivery))
    }
}
