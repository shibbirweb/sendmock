use sendmock_store::EmailLocalTemplateRecord;

use super::local_template_wire::{
    EmailTemplate, EmailTemplateChanges, EmailTemplateReference, EmailTemplateUpdate,
};
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

async fn find_template_or_not_found(
    operation_context: &OperationContext,
    template_id: &str,
) -> Result<EmailLocalTemplateRecord, OperationError> {
    operation_context
        .email_stores
        .local_templates
        .find_template(template_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No email template with id {template_id}"),
        })
}

pub struct ListEmailTemplatesOperation;

impl Operation for ListEmailTemplatesOperation {
    type Input = NoInput;
    type Output = Vec<EmailTemplate>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getEmailsTemplates",
            method: HttpMethod::Get,
            path: "/api/v1/emails/templates",
            summary: "Local email templates: a provider send naming one gets its subject and bodies.",
            is_read_only: true,
            cli_usage: "sendmock email templates list",
            mcp_tool: "sendmock_email_template_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<EmailTemplate>, OperationError> {
        let stored_templates = operation_context
            .email_stores
            .local_templates
            .list_templates()
            .await?;
        Ok(stored_templates
            .into_iter()
            .map(EmailTemplate::from)
            .collect())
    }
}

pub struct CreateEmailTemplateOperation;

impl Operation for CreateEmailTemplateOperation {
    type Input = EmailTemplate;
    type Output = EmailTemplate;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postEmailsTemplates",
            method: HttpMethod::Post,
            path: "/api/v1/emails/templates",
            summary: "Add a local email template under a provider's template id or name.",
            cli_usage: "sendmock email templates create",
            mcp_tool: "sendmock_email_template_create",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailTemplate,
    ) -> Result<EmailTemplate, OperationError> {
        let template_record = input.into_record()?;
        let local_templates = &operation_context.email_stores.local_templates;
        if local_templates
            .find_template(&template_record.template_id)
            .await?
            .is_some()
        {
            return Err(OperationError::Conflict {
                code: "email_template_exists",
                message: format!(
                    "An email template with id {} exists; change it instead",
                    template_record.template_id
                ),
            });
        }
        local_templates
            .save_template(template_record.clone())
            .await?;
        Ok(EmailTemplate::from(template_record))
    }
}

pub struct UpdateEmailTemplateOperation;

impl Operation for UpdateEmailTemplateOperation {
    type Input = EmailTemplateUpdate;
    type Output = EmailTemplate;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchEmailsTemplatesByTemplateId",
            method: HttpMethod::Patch,
            path: "/api/v1/emails/templates/{templateId}",
            summary: "Change a local email template's subject or bodies.",
            cli_usage: "sendmock email templates update <templateId>",
            mcp_tool: "sendmock_email_template_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailTemplateUpdate,
    ) -> Result<EmailTemplate, OperationError> {
        let stored_template =
            find_template_or_not_found(operation_context, &input.template_id).await?;
        let stored_view = EmailTemplate::from(stored_template);
        let changes: EmailTemplateChanges = input.changes.merge_onto(&stored_view)?;
        let template_record = EmailTemplate {
            id: stored_view.id,
            subject: changes.subject,
            text: changes.text,
            html: changes.html,
        }
        .into_record()?;
        operation_context
            .email_stores
            .local_templates
            .save_template(template_record.clone())
            .await?;
        Ok(EmailTemplate::from(template_record))
    }
}

pub struct DeleteEmailTemplateOperation;

impl Operation for DeleteEmailTemplateOperation {
    type Input = EmailTemplateReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteEmailsTemplatesByTemplateId",
            method: HttpMethod::Delete,
            path: "/api/v1/emails/templates/{templateId}",
            summary: "Remove a local email template; sends naming it keep their own bodies.",
            is_destructive: true,
            cli_usage: "sendmock email templates delete <templateId>",
            mcp_tool: "sendmock_email_template_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailTemplateReference,
    ) -> Result<NoContent, OperationError> {
        find_template_or_not_found(operation_context, &input.template_id).await?;
        operation_context
            .email_stores
            .local_templates
            .delete_template(&input.template_id)
            .await?;
        Ok(NoContent)
    }
}
