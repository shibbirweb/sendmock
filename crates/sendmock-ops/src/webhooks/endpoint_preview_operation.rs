use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use super::delivery_queue::DeliveryTrigger;
use super::delivery_request_rendering::render_delivery_request;
use super::delivery_template_context::DeliveryContextDetails;
use super::endpoint_inputs::WebhookEndpointInput;
use super::endpoint_view::read_request_settings;
use super::request_part_renderer::RenderProblem;
use super::secret_value_masking::{load_secret_values, mask_request_secrets};
use super::template_context::{ChosenMessage, find_template_subject};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

/// Body of `POST /api/v1/webhooks/endpoints/preview` (WH-07.15).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EndpointPreviewRequest {
    /// The endpoint settings to render, saved or not; left out, the saved endpoint
    /// `endpoint_id` names is rendered as stored.
    pub endpoint: Option<WebhookEndpointInput>,
    /// A saved endpoint's own variables are used too; alone, its stored settings are rendered.
    pub endpoint_id: Option<String>,
    /// Render against this email; without an email, SMS or request ID the sample event is used.
    pub email_id: Option<String>,
    /// Render against this SMS.
    pub sms_id: Option<String>,
    /// Render against this captured HTTP request.
    pub http_request_id: Option<String>,
    /// Send-time values by variable name (no `vars.`); they win for this render (WH-05.5).
    pub variables: Option<BTreeMap<String, String>>,
}

/// The request the endpoint would send, as a queued delivery renders it (WH-07.8); secret
/// variable values are masked.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct EndpointPreviewResult {
    /// What it was rendered against, e.g. "Built-in sample" or an email subject.
    pub rendered_against: String,
    pub event_type: String,
    pub method: String,
    pub url: String,
    pub headers: BTreeMap<String, String>,
    pub body: String,
    /// Errors stop a delivery as `render_failed`; warnings render empty.
    pub problems: Vec<RenderProblem>,
}

/// The settings sent, or the saved endpoint's when only its id is given.
async fn read_previewed_endpoint(
    operation_context: &OperationContext,
    input: &EndpointPreviewRequest,
) -> Result<WebhookEndpointInput, OperationError> {
    if let Some(endpoint_input) = &input.endpoint {
        return Ok(endpoint_input.clone());
    }
    let Some(endpoint_id) = input.endpoint_id.as_deref() else {
        return Err(OperationError::InvalidInput {
            message: "Pass the endpoint settings or an endpoint_id".to_owned(),
            field: Some("endpoint".to_owned()),
        });
    };
    let stored_endpoint = operation_context
        .webhook_endpoint_repository
        .find_endpoint(endpoint_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No webhook endpoint with id {endpoint_id}"),
        })?;
    Ok(WebhookEndpointInput {
        request_settings: read_request_settings(&stored_endpoint)?,
        name: stored_endpoint.name,
        url: stored_endpoint.url,
        is_enabled: stored_endpoint.is_enabled,
    })
}

pub struct PreviewWebhookEndpointOperation;

impl Operation for PreviewWebhookEndpointOperation {
    type Input = EndpointPreviewRequest;
    type Output = EndpointPreviewResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksEndpointsPreview",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/endpoints/preview",
            summary: "Render an unsaved endpoint's request against a message.",
            cli_usage: "sendmock webhook render",
            mcp_tool: "sendmock_webhook_render",
            is_read_only: true,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EndpointPreviewRequest,
    ) -> Result<EndpointPreviewResult, OperationError> {
        let endpoint_input = read_previewed_endpoint(operation_context, &input).await?;
        let template_subject = find_template_subject(
            operation_context,
            ChosenMessage {
                email_id: input.email_id.as_deref(),
                sms_id: input.sms_id.as_deref(),
                http_request_id: input.http_request_id.as_deref(),
                sample_event_type: None,
            },
        )
        .await?;
        let send_time_values: Map<String, Value> = input
            .variables
            .unwrap_or_default()
            .into_iter()
            .map(|(variable_name, typed_value)| (variable_name, Value::from(typed_value)))
            .collect();
        let preview_delivery_id = operation_context.id_generator.generate_id().to_string();
        let preview_request_id = operation_context.id_generator.generate_id().to_string();
        let rendered_delivery = render_delivery_request(
            operation_context,
            &DeliveryContextDetails {
                app_event: &template_subject.app_event,
                endpoint_id: input.endpoint_id.as_deref(),
                endpoint_name: &endpoint_input.name,
                endpoint_url: &endpoint_input.url,
                delivery_id: &preview_delivery_id,
                delivery_trigger: DeliveryTrigger::Manual,
                rule_id: None,
                request_id: &preview_request_id,
                send_time_values: &send_time_values,
            },
            &endpoint_input.request_settings,
        )
        .await?;
        let shown_request = mask_request_secrets(
            &rendered_delivery.request,
            &load_secret_values(operation_context).await?,
        );
        Ok(EndpointPreviewResult {
            rendered_against: template_subject.rendered_against,
            event_type: template_subject.app_event.event_type,
            method: shown_request.method,
            url: shown_request.url,
            headers: shown_request.headers,
            body: shown_request.body,
            problems: rendered_delivery.problems,
        })
    }
}
