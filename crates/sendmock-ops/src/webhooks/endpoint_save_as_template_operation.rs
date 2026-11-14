use super::endpoint_inputs::EndpointSaveAsTemplateRequest;
use super::endpoint_operations::find_stored_endpoint;
use super::endpoint_template::{find_endpoint_template_draft, read_detached_template};
use super::endpoint_template_overrides::fold_endpoint_overrides;
use super::endpoint_view::read_request_settings;
use super::template_operations::read_template_name;
use super::template_store::{create_custom_template, find_resolved_template};
use super::template_view::{TemplateMetadata, WebhookTemplateSummary};
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, SuccessStatus,
};

/// The template the endpoint uses, if it still exists; a deleted one leaves a plain custom
/// template.
async fn find_base_summary(
    operation_context: &OperationContext,
    template_id: &str,
) -> Result<Option<WebhookTemplateSummary>, OperationError> {
    match find_resolved_template(operation_context, template_id).await {
        Ok(base_template) => Ok(Some(base_template.summary)),
        Err(OperationError::NotFound { .. }) => Ok(None),
        Err(other_error) => Err(other_error),
    }
}

pub struct SaveWebhookEndpointAsTemplateOperation;

impl Operation for SaveWebhookEndpointAsTemplateOperation {
    type Input = EndpointSaveAsTemplateRequest;
    type Output = WebhookTemplateSummary;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksEndpointsByEndpointIdSaveAsTemplate",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/endpoints/{endpointId}/save-as-template",
            summary: "Save the endpoint's request as a custom template.",
            cli_usage: "sendmock webhook endpoint save-as-template <endpointId>",
            mcp_tool: "sendmock_webhook_endpoint_save_as_template",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The endpoint's template (its own copy while detached) with the endpoint's headers and
    /// extra fields written into it.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EndpointSaveAsTemplateRequest,
    ) -> Result<WebhookTemplateSummary, OperationError> {
        let template_name = read_template_name(&input.name)?;
        let stored_endpoint = find_stored_endpoint(operation_context, &input.endpoint_id).await?;
        let request_settings = read_request_settings(&stored_endpoint)?;
        let detached_template = read_detached_template(&stored_endpoint)?;
        let template_id = &request_settings.template_id;
        let template_draft = find_endpoint_template_draft(
            operation_context,
            &request_settings,
            detached_template.as_ref(),
        )
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No webhook template with id {template_id}"),
        })?;
        let base_summary = find_base_summary(operation_context, template_id).await?;
        let metadata = TemplateMetadata {
            name: template_name,
            description: format!("Saved from the endpoint \"{}\".", stored_endpoint.name),
            events: base_summary
                .as_ref()
                .map(|base_summary| base_summary.events.clone())
                .unwrap_or_default(),
            required_variables: base_summary
                .as_ref()
                .map(|base_summary| base_summary.required_variables.clone())
                .unwrap_or_default(),
        };
        let service =
            base_summary.map_or_else(|| "Custom".to_owned(), |base_summary| base_summary.service);
        let saved_draft = fold_endpoint_overrides(
            &template_draft,
            &request_settings.headers,
            &request_settings.extra_fields,
        );
        create_custom_template(operation_context, metadata, service, saved_draft).await
    }
}
