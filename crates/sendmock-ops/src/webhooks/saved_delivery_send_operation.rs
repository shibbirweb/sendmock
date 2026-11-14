use sendmock_store::{SavedWebhookDeliveryRecord, WebhookEndpointRecord};

use super::delivery_queue::{
    DeliveryOrder, DeliveryTrigger, build_first_attempt, queue_first_attempt,
    render_planned_delivery,
};
use super::delivery_replay_operation::{parse_json, restore_event_under_new_id};
use super::delivery_request_plan::DeliveryRequestPlan;
use super::delivery_request_rendering::RenderedDeliveryRequest;
use super::delivery_view::WebhookDelivery;
use super::endpoint_settings::RetryPolicy;
use super::endpoint_test_operation::{TEST_EVENT_TYPE, build_test_plan};
use super::saved_delivery_inputs::SavedDeliverySendRequest;
use super::saved_delivery_operations::find_stored_saved_delivery;
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
    RecordedHttpRequest,
};

/// The endpoint picked in the send dialog; a missing one is a bad choice, not a missing page.
async fn find_target_endpoint(
    operation_context: &OperationContext,
    endpoint_id: &str,
) -> Result<WebhookEndpointRecord, OperationError> {
    operation_context
        .webhook_endpoint_repository
        .find_endpoint(endpoint_id)
        .await?
        .ok_or_else(|| OperationError::InvalidInput {
            message: "Pick an endpoint".to_owned(),
            field: Some("endpoint_id".to_owned()),
        })
}

/// One send of a saved delivery to the endpoint picked for it.
struct SavedSend<'send> {
    target_endpoint: &'send WebhookEndpointRecord,
    send_order: &'send DeliveryOrder,
    delivery_id: &'send str,
}

impl SavedSend<'_> {
    async fn render_plan(
        &self,
        operation_context: &OperationContext,
        request_plan: &DeliveryRequestPlan,
    ) -> Result<RenderedDeliveryRequest, OperationError> {
        render_planned_delivery(
            operation_context,
            self.target_endpoint,
            self.send_order,
            request_plan,
            self.delivery_id,
        )
        .await
    }

    /// The saved event rendered with the target endpoint's settings and variables as they are
    /// now; a `test.ping` keeps its fixed test body and its single attempt.
    async fn render_again(
        &self,
        operation_context: &OperationContext,
    ) -> Result<(RenderedDeliveryRequest, RetryPolicy), OperationError> {
        let request_plan = if self.send_order.app_event.event_type == TEST_EVENT_TYPE {
            build_test_plan(self.target_endpoint, &self.send_order.app_event)?
        } else {
            DeliveryRequestPlan::from_endpoint(self.target_endpoint)?
        };
        let rendered_delivery = self.render_plan(operation_context, &request_plan).await?;
        Ok((
            rendered_delivery,
            request_plan.request_settings.retry_policy,
        ))
    }

    /// The saved method, headers and body sent to the target endpoint's URL and query, which
    /// are still rendered; only their problems can stop the send.
    async fn render_as_is(
        &self,
        operation_context: &OperationContext,
        saved_request: RecordedHttpRequest,
    ) -> Result<(RenderedDeliveryRequest, RetryPolicy), OperationError> {
        let mut request_plan = DeliveryRequestPlan::from_endpoint(self.target_endpoint)?;
        request_plan.edited_body = Some(saved_request.body);
        let mut rendered_delivery = self.render_plan(operation_context, &request_plan).await?;
        rendered_delivery.request.method = saved_request.method;
        rendered_delivery.request.headers = saved_request.headers;
        rendered_delivery
            .problems
            .retain(|render_problem| !render_problem.source.starts_with("header."));
        Ok((
            rendered_delivery,
            request_plan.request_settings.retry_policy,
        ))
    }
}

fn missing_event_error() -> OperationError {
    OperationError::InvalidInput {
        message: "This saved delivery has no event to render again; send it as it was instead."
            .to_owned(),
        field: Some("rerender".to_owned()),
    }
}

fn build_send_order(
    saved_delivery: &SavedWebhookDeliveryRecord,
    new_event_id: String,
) -> Result<(DeliveryOrder, bool), OperationError> {
    let restored_event = restore_event_under_new_id(
        saved_delivery.event_json.as_deref(),
        saved_delivery
            .event_type
            .as_deref()
            .unwrap_or(TEST_EVENT_TYPE),
        saved_delivery.saved_at_unix_ms,
        new_event_id,
    )?;
    let send_order = DeliveryOrder {
        app_event: restored_event.app_event,
        subject_id: None,
        rule_id: None,
        delivery_trigger: DeliveryTrigger::Manual,
        send_time_values: serde_json::Map::new(),
    };
    Ok((send_order, restored_event.event_json_is_missing))
}

pub struct SendSavedWebhookDeliveryOperation;

impl Operation for SendSavedWebhookDeliveryOperation {
    type Input = SavedDeliverySendRequest;
    type Output = WebhookDelivery;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksSavedBySavedIdSend",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/saved/{savedId}/send",
            summary: "Send a saved request to its endpoint or another one.",
            cli_usage: "sendmock webhook saved send <savedId>",
            mcp_tool: "sendmock_webhook_saved_send",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Queues a `manual` delivery to any endpoint under a new event id (WH-10.2), with that
    /// endpoint's retry policy: the saved request as it was, or its event rendered again.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SavedDeliverySendRequest,
    ) -> Result<WebhookDelivery, OperationError> {
        let saved_delivery = find_stored_saved_delivery(operation_context, &input.saved_id).await?;
        let target_endpoint = find_target_endpoint(operation_context, &input.endpoint_id).await?;
        let new_event_id = format!("evt_{}", operation_context.id_generator.generate_id());
        let (send_order, event_json_is_missing) = build_send_order(&saved_delivery, new_event_id)?;
        if input.rerender && event_json_is_missing {
            return Err(missing_event_error());
        }
        let delivery_id = operation_context.id_generator.generate_id().to_string();
        let saved_send = SavedSend {
            target_endpoint: &target_endpoint,
            send_order: &send_order,
            delivery_id: &delivery_id,
        };
        let (rendered_delivery, retry_policy) = if input.rerender {
            saved_send.render_again(operation_context).await?
        } else {
            let saved_request = parse_json(&saved_delivery.request_json)?;
            saved_send
                .render_as_is(operation_context, saved_request)
                .await?
        };
        let mut sent_delivery = build_first_attempt(
            &target_endpoint,
            send_order,
            delivery_id,
            &retry_policy,
            &rendered_delivery,
            operation_context.clock.now_unix_ms(),
        )?;
        if event_json_is_missing {
            sent_delivery.event_json = None;
        }
        let queued_delivery = queue_first_attempt(operation_context, sent_delivery).await?;
        Ok(WebhookDelivery::from(queued_delivery))
    }
}
