use sendmock_store::{WebhookDeliveryRecord, WebhookEndpointRecord};
use serde_json::json;

use super::delivery_detail::find_delivery_or_not_found;
use super::delivery_dispatch::send_claimed_delivery;
use super::delivery_queue::{DeliveryOrder, DeliveryTrigger, build_planned_attempt};
use super::delivery_request_plan::DeliveryRequestPlan;
use super::delivery_view::WebhookDelivery;
use super::endpoint_inputs::WebhookEndpointReference;
use super::endpoint_operations::find_stored_endpoint;
use super::endpoint_settings::EndpointBodyMode;
use crate::{
    AppEvent, HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
};

pub(super) const TEST_EVENT_TYPE: &str = "test.ping";

fn build_test_event(
    stored_endpoint: &WebhookEndpointRecord,
    event_id: String,
    created_at: String,
) -> AppEvent {
    AppEvent {
        id: event_id,
        event_type: TEST_EVENT_TYPE.to_owned(),
        created_at,
        data: json!({
            "endpoint": stored_endpoint.name,
            "message": "Hello from SendMock",
        }),
    }
}

/// The endpoint's URL, method, query and headers with a fixed Standard Webhooks JSON body, so
/// the test works whatever the endpoint's template expects. One attempt, never retried.
pub(super) fn build_test_plan(
    stored_endpoint: &WebhookEndpointRecord,
    test_event: &AppEvent,
) -> Result<DeliveryRequestPlan, OperationError> {
    let mut request_plan = DeliveryRequestPlan::from_endpoint(stored_endpoint)?;
    let request_settings = &mut request_plan.request_settings;
    request_settings.body_mode = EndpointBodyMode::Raw;
    request_settings.raw_content_type = "application/json".to_owned();
    request_settings.retry_policy.max_attempts = 1;
    request_plan.edited_body = Some(
        json!({
            "type": test_event.event_type,
            "timestamp": test_event.created_at,
            "data": test_event.data,
        })
        .to_string(),
    );
    Ok(request_plan)
}

/// Stores the attempt already `in_flight`, so the dispatcher never picks it up, and sends it
/// now; a restart in between queues it again like any other unfinished attempt.
async fn send_test_attempt(
    operation_context: &OperationContext,
    test_delivery: WebhookDeliveryRecord,
) -> Result<WebhookDeliveryRecord, OperationError> {
    let delivery_repository = &operation_context.webhook_delivery_repository;
    if test_delivery.status != "pending" {
        delivery_repository
            .insert_delivery(test_delivery.clone())
            .await?;
        return Ok(test_delivery);
    }
    let in_flight_delivery = WebhookDeliveryRecord {
        status: "in_flight".to_owned(),
        next_attempt_at_unix_ms: None,
        ..test_delivery
    };
    delivery_repository
        .insert_delivery(in_flight_delivery.clone())
        .await?;
    send_claimed_delivery(operation_context, &in_flight_delivery).await?;
    find_delivery_or_not_found(operation_context, &in_flight_delivery.delivery_id).await
}

pub struct TestWebhookEndpointOperation;

impl Operation for TestWebhookEndpointOperation {
    type Input = WebhookEndpointReference;
    type Output = WebhookDelivery;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksEndpointsByEndpointIdTest",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/endpoints/{endpointId}/test",
            summary: "Send a test.ping delivery.",
            cli_usage: "sendmock webhook endpoint test <endpointId>",
            mcp_tool: "sendmock_webhook_endpoint_test",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Sends `test.ping` and answers with the finished attempt: the response, or why it could
    /// not be sent (WH-01.2). Disabled endpoints are tested too.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookEndpointReference,
    ) -> Result<WebhookDelivery, OperationError> {
        let stored_endpoint = find_stored_endpoint(operation_context, &input.endpoint_id).await?;
        let test_event = build_test_event(
            &stored_endpoint,
            format!("evt_{}", operation_context.id_generator.generate_id()),
            sendmock_core::format_rfc3339(operation_context.clock.now_unix_ms()),
        );
        let request_plan = build_test_plan(&stored_endpoint, &test_event)?;
        let delivery_order = DeliveryOrder {
            app_event: test_event,
            subject_id: None,
            rule_id: None,
            delivery_trigger: DeliveryTrigger::Manual,
            send_time_values: serde_json::Map::new(),
        };
        let test_delivery = build_planned_attempt(
            operation_context,
            &stored_endpoint,
            delivery_order,
            &request_plan,
        )
        .await?;
        let finished_delivery = send_test_attempt(operation_context, test_delivery).await?;
        Ok(WebhookDelivery::from(finished_delivery))
    }
}
