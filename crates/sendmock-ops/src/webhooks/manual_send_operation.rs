use std::collections::BTreeMap;

use schemars::JsonSchema;
use sendmock_store::WebhookEndpointRecord;
use serde::Deserialize;

use super::delivery_queue::{
    DeliveryOrder, DeliveryTrigger, build_planned_attempt, queue_first_attempt,
};
use super::delivery_request_plan::DeliveryRequestPlan;
use super::delivery_template_context::to_send_time_values;
use super::delivery_view::WebhookDelivery;
use super::endpoint_inputs::WebhookEndpointInput;
use super::endpoint_operations::find_stored_endpoint;
use super::endpoint_preview_operation::find_send_subject;
use super::endpoint_settings::{EndpointBodyMode, TemplateMode};
use super::endpoint_validation::validate_endpoint_input;
use super::template_context::ChosenMessage;
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, SuccessStatus,
};

/// `POST /api/v1/webhooks/endpoints/{endpointId}/send` (WH-05).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ManualSendRequest {
    /// The webhook endpoint's ID, from `GET /api/v1/webhooks/endpoints`.
    pub endpoint_id: String,
    /// Send this email as the event.
    pub email_id: Option<String>,
    /// Send this SMS as the event.
    pub sms_id: Option<String>,
    /// A captured HTTP request, sent as an `http.captured` event (HC-01.7).
    pub http_request_id: Option<String>,
    /// A template used for this send instead of the endpoint's request.
    pub template_id: Option<String>,
    /// A hand-written request replacing the endpoint's, from the composer.
    pub request: Option<WebhookEndpointInput>,
    /// Send-time values by variable name (no `vars.`), for this send only (WH-05.5).
    pub variables: Option<BTreeMap<String, String>>,
    /// An edited body, sent as written (WH-05.6).
    pub body: Option<String>,
}

/// The endpoint's request, or the composer's, with the chosen template as the body for this
/// send (WH-05.1, WH-05.3). The endpoint's own template copy is kept only while the send
/// renders the same template.
fn build_send_plan(
    stored_endpoint: &WebhookEndpointRecord,
    input: &ManualSendRequest,
) -> Result<DeliveryRequestPlan, OperationError> {
    let mut request_plan = DeliveryRequestPlan::from_endpoint(stored_endpoint)?;
    let saved_template_id = request_plan.request_settings.template_id.clone();
    if let Some(written_request) = &input.request {
        validate_endpoint_input(written_request)?;
        request_plan.url_template = written_request.url.clone();
        request_plan.request_settings = written_request.request_settings.clone();
    }
    if let Some(template_id) = &input.template_id {
        let request_settings = &mut request_plan.request_settings;
        request_settings.body_mode = EndpointBodyMode::Template;
        request_settings.template_id = template_id.clone();
        request_settings.template_mode = TemplateMode::Linked;
        request_settings.extra_fields.clear();
    }
    if request_plan.request_settings.template_id != saved_template_id
        || request_plan.request_settings.template_mode == TemplateMode::Linked
    {
        request_plan.detached_template = None;
    }
    request_plan.edited_body = input.body.clone();
    Ok(request_plan)
}

pub struct SendWebhookOperation;

impl Operation for SendWebhookOperation {
    type Input = ManualSendRequest;
    type Output = WebhookDelivery;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksEndpointsByEndpointIdSend",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/endpoints/{endpointId}/send",
            summary: "Send a webhook for a chosen message or the sample, by hand.",
            cli_usage: "sendmock webhook send --endpoint <endpointId>",
            mcp_tool: "sendmock_webhook_send",
            cli_flag_names: &[("endpoint_id", "endpoint")],
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Queues a `manual` delivery with a new event id, so every send is its own message to
    /// the receiver; a render error stores it as `render_failed`, never sent (WH-05.6).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ManualSendRequest,
    ) -> Result<WebhookDelivery, OperationError> {
        let stored_endpoint = find_stored_endpoint(operation_context, &input.endpoint_id).await?;
        let request_plan = build_send_plan(&stored_endpoint, &input)?;
        let chosen_message = ChosenMessage {
            email_id: input.email_id.as_deref(),
            sms_id: input.sms_id.as_deref(),
            http_request_id: input.http_request_id.as_deref(),
            sample_event_type: None,
        };
        let mut template_subject = find_send_subject(
            operation_context,
            chosen_message,
            &request_plan.request_settings,
        )
        .await?;
        template_subject.app_event.id =
            format!("evt_{}", operation_context.id_generator.generate_id());
        let delivery_order = DeliveryOrder {
            app_event: template_subject.app_event,
            subject_id: input.email_id.or(input.sms_id).or(input.http_request_id),
            rule_id: None,
            delivery_trigger: DeliveryTrigger::Manual,
            send_time_values: to_send_time_values(input.variables),
        };
        let manual_delivery = build_planned_attempt(
            operation_context,
            &stored_endpoint,
            delivery_order,
            &request_plan,
        )
        .await?;
        let queued_delivery = queue_first_attempt(operation_context, manual_delivery).await?;
        Ok(WebhookDelivery::from(queued_delivery))
    }
}
