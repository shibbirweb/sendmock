use super::endpoint_settings::TemplateMode;
use super::endpoint_template::write_detached_template;
use super::endpoint_view::{read_request_settings, write_request_settings};
use super::template_inputs::TemplateDeleteRequest;
use super::template_operations::template_definition;
use super::template_store::{count_using_endpoints, find_resolved_template};
use super::template_view::{TemplateDraft, TemplateSource};
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

/// Detaches the endpoints that use a deleted template; a linked one keeps a copy of it as it
/// is now, a detached one keeps the copy it has.
async fn detach_using_endpoints(
    operation_context: &OperationContext,
    template_id: &str,
    template_draft: &TemplateDraft,
) -> Result<(), OperationError> {
    let endpoint_repository = &operation_context.webhook_endpoint_repository;
    for stored_endpoint in endpoint_repository.list_endpoints().await? {
        let mut request_settings = read_request_settings(&stored_endpoint)?;
        let is_linked = request_settings.template_mode == TemplateMode::Linked;
        if request_settings.template_id != template_id
            || (!is_linked && stored_endpoint.detached_template_json.is_some())
        {
            continue;
        }
        request_settings.template_mode = TemplateMode::Detached;
        endpoint_repository
            .update_endpoint(sendmock_store::WebhookEndpointRecord {
                request_settings_json: write_request_settings(&request_settings)?,
                detached_template_json: write_detached_template(Some(template_draft))?,
                ..stored_endpoint
            })
            .await?;
    }
    Ok(())
}

pub struct DeleteWebhookTemplateOperation;

impl Operation for DeleteWebhookTemplateOperation {
    type Input = TemplateDeleteRequest;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::NoContent,
            is_destructive: true,
            ..template_definition(
                "deleteWebhooksTemplatesByTemplateId",
                HttpMethod::Delete,
                "/api/v1/webhooks/templates/{templateId}",
                "Delete a custom template; 409 while endpoints use it.",
                "sendmock webhook template delete <templateId>",
                "sendmock_webhook_template_delete",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TemplateDeleteRequest,
    ) -> Result<NoContent, OperationError> {
        let template_id = &input.template_id;
        let resolved_template = find_resolved_template(operation_context, template_id).await?;
        if resolved_template.summary.source != TemplateSource::Custom {
            return Err(OperationError::Conflict {
                code: "read_only_template",
                message:
                    "Built-in and file templates cannot be deleted. Clone one to make your own."
                        .to_owned(),
            });
        }
        let using_count = count_using_endpoints(operation_context, template_id).await?;
        if using_count > 0 && input.endpoints.as_deref() != Some("detach") {
            return Err(OperationError::Conflict {
                code: "template_in_use",
                message: format!(
                    "{using_count} endpoint(s) use this template. Detach them or cancel."
                ),
            });
        }
        detach_using_endpoints(operation_context, template_id, &resolved_template.draft).await?;
        operation_context
            .webhook_template_repository
            .delete_template(template_id)
            .await?;
        Ok(NoContent)
    }
}
