use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::delivery_queue::DeliveryTrigger;
use super::delivery_request_rendering::render_delivery_request;
use super::delivery_template_context::{DeliveryContextDetails, to_send_time_values};
use super::endpoint_inputs::WebhookEndpointInput;
use super::endpoint_settings::{
    EndpointBodyMode, EndpointRequestSettings, default_request_settings,
};
use super::endpoint_template::read_detached_template;
use super::endpoint_view::read_request_settings;
use super::request_part_renderer::RenderProblem;
use super::secret_value_masking::{load_secret_values, mask_request_secrets};
use super::template_context::{ChosenMessage, TemplateSubject, find_template_subject};
use super::template_store::find_resolved_template;
use super::template_view::TemplateDraft;
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, PartialChanges,
};

/// Body of `POST /api/v1/webhooks/endpoints/preview` (WH-07.15).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EndpointPreviewRequest {
    /// The endpoint settings to render, saved or not, as many fields as you like: the rest
    /// come from the saved endpoint `endpoint_id` names, or a new endpoint's defaults.
    /// Left out, the saved endpoint is rendered as stored.
    pub endpoint: Option<PartialChanges<WebhookEndpointInput>>,
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

struct PreviewedEndpoint {
    endpoint_input: WebhookEndpointInput,
    /// The saved endpoint's own copy, while the rendered settings use the same template.
    detached_template: Option<TemplateDraft>,
}

/// The settings sent, or the saved endpoint's when only its id is given.
async fn read_previewed_endpoint(
    operation_context: &OperationContext,
    input: &EndpointPreviewRequest,
) -> Result<PreviewedEndpoint, OperationError> {
    let stored_endpoint = match input.endpoint_id.as_deref() {
        Some(endpoint_id) => {
            operation_context
                .webhook_endpoint_repository
                .find_endpoint(endpoint_id)
                .await?
        }
        None => None,
    };
    let stored_fields = match &stored_endpoint {
        Some(stored_endpoint) => Some(serde_json::json!({
            "name": stored_endpoint.name,
            "url": stored_endpoint.url,
            "is_enabled": stored_endpoint.is_enabled,
            "settings": read_request_settings(stored_endpoint)?,
        })),
        None => None,
    };
    let endpoint_input = match (&input.endpoint, stored_fields) {
        (Some(endpoint_changes), stored_fields) => {
            endpoint_changes.merge_onto(&build_merge_base(stored_fields))?
        }
        (None, Some(stored_fields)) => PartialChanges::<WebhookEndpointInput>::default()
            .merge_onto(&build_merge_base(Some(stored_fields)))?,
        (None, None) => {
            return Err(match input.endpoint_id.as_deref() {
                Some(endpoint_id) => OperationError::NotFound {
                    message: format!("No webhook endpoint with id {endpoint_id}"),
                },
                None => OperationError::InvalidInput {
                    message: "Pass the endpoint settings or an endpoint_id".to_owned(),
                    field: Some("endpoint".to_owned()),
                },
            });
        }
    };
    let mut detached_template = None;
    if let Some(stored_endpoint) = &stored_endpoint
        && read_request_settings(stored_endpoint)?.template_id
            == endpoint_input.request_settings.template_id
    {
        detached_template = read_detached_template(stored_endpoint)?;
    }
    Ok(PreviewedEndpoint {
        endpoint_input,
        detached_template,
    })
}

/// What a partial endpoint is completed with: the saved endpoint's fields, or a new endpoint's
/// (no name or URL yet, on, and the default request settings).
fn build_merge_base(stored_fields: Option<serde_json::Value>) -> serde_json::Value {
    let (name, url, is_enabled, settings) = match stored_fields {
        Some(stored_fields) => (
            stored_fields["name"].clone(),
            stored_fields["url"].clone(),
            stored_fields["is_enabled"].clone(),
            stored_fields["settings"].clone(),
        ),
        None => (
            serde_json::json!(""),
            serde_json::json!(""),
            serde_json::json!(true),
            default_request_settings(),
        ),
    };
    let mut merge_base = settings;
    if let serde_json::Value::Object(base_fields) = &mut merge_base {
        base_fields.insert("name".to_owned(), name);
        base_fields.insert("url".to_owned(), url);
        base_fields.insert("is_enabled".to_owned(), is_enabled);
    }
    merge_base
}

/// The first event a Template-mode endpoint's template is made for, so the sample fits it.
async fn find_template_event_type(
    operation_context: &OperationContext,
    request_settings: &EndpointRequestSettings,
) -> Result<Option<String>, OperationError> {
    if request_settings.body_mode != EndpointBodyMode::Template {
        return Ok(None);
    }
    match find_resolved_template(operation_context, &request_settings.template_id).await {
        Ok(resolved_template) => Ok(resolved_template.summary.events.first().cloned()),
        Err(OperationError::NotFound { .. }) => Ok(None),
        Err(other_error) => Err(other_error),
    }
}

/// The chosen message, or the sample that fits the endpoint's template.
pub(super) async fn find_send_subject(
    operation_context: &OperationContext,
    chosen_message: ChosenMessage<'_>,
    request_settings: &EndpointRequestSettings,
) -> Result<TemplateSubject, OperationError> {
    let template_event_type = find_template_event_type(operation_context, request_settings).await?;
    find_template_subject(
        operation_context,
        ChosenMessage {
            sample_event_type: template_event_type.as_deref(),
            ..chosen_message
        },
    )
    .await
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
        let PreviewedEndpoint {
            endpoint_input,
            detached_template,
        } = read_previewed_endpoint(operation_context, &input).await?;
        let template_subject = find_send_subject(
            operation_context,
            ChosenMessage {
                email_id: input.email_id.as_deref(),
                sms_id: input.sms_id.as_deref(),
                http_request_id: input.http_request_id.as_deref(),
                ..ChosenMessage::default()
            },
            &endpoint_input.request_settings,
        )
        .await?;
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
                send_time_values: &to_send_time_values(input.variables),
            },
            &endpoint_input.request_settings,
            detached_template.as_ref(),
            None,
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
