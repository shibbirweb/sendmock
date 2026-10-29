use super::template_catalogue::{NATIVE_TEMPLATE_ID, find_builtin_template};
use super::template_context::ChosenMessage;
use super::template_inputs::{
    TemplateCloneRequest, TemplateCreateRequest, TemplateRenderRequest, WebhookTemplateReference,
};
use super::template_rendering::{TemplateRenderResult, render_template_draft};
use super::template_store::{
    count_using_endpoints, create_custom_template, find_resolved_template, list_resolved_templates,
};
use super::template_view::{TemplateMetadata, WebhookTemplateDetail, WebhookTemplateSummary};
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, SuccessStatus,
};

pub(super) fn template_definition(
    operation_id: &'static str,
    method: HttpMethod,
    path: &'static str,
    summary: &'static str,
    cli_usage: &'static str,
    mcp_tool: &'static str,
) -> OperationDefinition {
    OperationDefinition {
        operation_id,
        method,
        path,
        summary,
        cli_usage,
        mcp_tool,
        ..OperationDefinition::DEFAULTS
    }
}

fn read_template_name(template_name: &str) -> Result<String, OperationError> {
    let trimmed_name = template_name.trim();
    if trimmed_name.is_empty() {
        return Err(OperationError::InvalidInput {
            message: "Enter a name".to_owned(),
            field: Some("name".to_owned()),
        });
    }
    Ok(trimmed_name.to_owned())
}

pub(super) async fn load_template_detail(
    operation_context: &OperationContext,
    template_id: &str,
) -> Result<WebhookTemplateDetail, OperationError> {
    let resolved_template = find_resolved_template(operation_context, template_id).await?;
    let used_by_endpoint_count = count_using_endpoints(operation_context, template_id).await?;
    Ok(resolved_template.into_detail(used_by_endpoint_count))
}

pub struct ListWebhookTemplatesOperation;

impl Operation for ListWebhookTemplatesOperation {
    type Input = crate::NoInput;
    type Output = Vec<WebhookTemplateSummary>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..template_definition(
                "getWebhooksTemplates",
                HttpMethod::Get,
                "/api/v1/webhooks/templates",
                "Built-in and custom payload templates.",
                "sendmock webhook template list",
                "sendmock_webhook_template_list",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: crate::NoInput,
    ) -> Result<Vec<WebhookTemplateSummary>, OperationError> {
        Ok(list_resolved_templates(operation_context)
            .await?
            .into_iter()
            .map(|resolved_template| resolved_template.summary)
            .collect())
    }
}

pub struct GetWebhookTemplateOperation;

impl Operation for GetWebhookTemplateOperation {
    type Input = WebhookTemplateReference;
    type Output = WebhookTemplateDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..template_definition(
                "getWebhooksTemplatesByTemplateId",
                HttpMethod::Get,
                "/api/v1/webhooks/templates/{templateId}",
                "One template with its method, headers and body template.",
                "sendmock webhook template show <templateId>",
                "sendmock_webhook_template_get",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookTemplateReference,
    ) -> Result<WebhookTemplateDetail, OperationError> {
        load_template_detail(operation_context, &input.template_id).await
    }
}

pub struct CreateWebhookTemplateOperation;

impl Operation for CreateWebhookTemplateOperation {
    type Input = TemplateCreateRequest;
    type Output = WebhookTemplateSummary;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            ..template_definition(
                "postWebhooksTemplates",
                HttpMethod::Post,
                "/api/v1/webhooks/templates",
                "Add a custom template, starting as native JSON.",
                "sendmock webhook template create",
                "sendmock_webhook_template_create",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TemplateCreateRequest,
    ) -> Result<WebhookTemplateSummary, OperationError> {
        let native_template = find_builtin_template(NATIVE_TEMPLATE_ID)
            .ok_or_else(|| OperationError::Internal("The native template is missing".to_owned()))?;
        let metadata = TemplateMetadata {
            name: read_template_name(&input.name)?,
            description: String::new(),
            events: vec!["email.received".to_owned()],
            required_variables: Vec::new(),
        };
        create_custom_template(
            operation_context,
            metadata,
            "Custom".to_owned(),
            native_template.draft,
        )
        .await
    }
}

pub struct CloneWebhookTemplateOperation;

impl Operation for CloneWebhookTemplateOperation {
    type Input = TemplateCloneRequest;
    type Output = WebhookTemplateSummary;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            ..template_definition(
                "postWebhooksTemplatesByTemplateIdClone",
                HttpMethod::Post,
                "/api/v1/webhooks/templates/{templateId}/clone",
                "Copy a template into a new custom one.",
                "sendmock webhook template clone <templateId>",
                "sendmock_webhook_template_clone",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TemplateCloneRequest,
    ) -> Result<WebhookTemplateSummary, OperationError> {
        let source_template = find_resolved_template(operation_context, &input.template_id).await?;
        let metadata = TemplateMetadata {
            name: read_template_name(&input.name)?,
            description: format!("Copy of {}.", source_template.summary.name),
            ..source_template.metadata()
        };
        create_custom_template(
            operation_context,
            metadata,
            source_template.summary.service,
            source_template.draft,
        )
        .await
    }
}

pub struct RenderWebhookTemplateOperation;

impl Operation for RenderWebhookTemplateOperation {
    type Input = TemplateRenderRequest;
    type Output = TemplateRenderResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..template_definition(
                "postWebhooksTemplatesByTemplateIdRender",
                HttpMethod::Post,
                "/api/v1/webhooks/templates/{templateId}/render",
                "Render against an email, an SMS or the sample, optionally a draft.",
                "sendmock webhook template render <templateId>",
                "sendmock_webhook_template_render",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TemplateRenderRequest,
    ) -> Result<TemplateRenderResult, OperationError> {
        let resolved_template =
            find_resolved_template(operation_context, &input.template_id).await?;
        let template_draft = input.draft.unwrap_or(resolved_template.draft);
        render_template_draft(
            operation_context,
            &template_draft,
            ChosenMessage {
                email_id: input.email_id.as_deref(),
                sms_id: input.sms_id.as_deref(),
                http_request_id: input.http_request_id.as_deref(),
                sample_event_type: resolved_template.summary.events.first().map(String::as_str),
            },
        )
        .await
    }
}
