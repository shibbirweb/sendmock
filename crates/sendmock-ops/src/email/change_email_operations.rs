use super::email_inputs::{EmailReference, EmailUpdateInput};
use super::email_summary::EmailSummary;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

pub struct UpdateEmailOperation;

impl Operation for UpdateEmailOperation {
    type Input = EmailUpdateInput;
    type Output = EmailSummary;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchEmailsByEmailId",
            method: HttpMethod::Patch,
            path: "/api/v1/emails/{emailId}",
            summary: "Mark read or unread, or change tags.",
            cli_usage: "sendmock email update <emailId>",
            mcp_tool: "sendmock_email_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailUpdateInput,
    ) -> Result<EmailSummary, OperationError> {
        let tags = input.tags.map(|tags| {
            tags.into_iter()
                .map(|tag| tag.trim().to_lowercase())
                .filter(|tag| !tag.is_empty())
                .collect()
        });
        operation_context
            .email_repository
            .update_read_and_tags(&input.email_id, input.is_read, tags)
            .await?
            .map(|email| EmailSummary::from(&email))
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No email with id {}", input.email_id),
            })
    }
}

pub struct DeleteEmailOperation;

impl Operation for DeleteEmailOperation {
    type Input = EmailReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteEmailsByEmailId",
            method: HttpMethod::Delete,
            path: "/api/v1/emails/{emailId}",
            summary: "Delete one email.",
            is_destructive: true,
            cli_usage: "sendmock email delete <emailId>",
            mcp_tool: "sendmock_email_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deleting an email that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .email_repository
            .delete_email(&input.email_id)
            .await?;
        Ok(NoContent)
    }
}

pub struct DeleteAllEmailsOperation;

impl Operation for DeleteAllEmailsOperation {
    type Input = NoInput;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteEmails",
            method: HttpMethod::Delete,
            path: "/api/v1/emails",
            summary: "Delete every email.",
            is_destructive: true,
            cli_usage: "sendmock email delete-all",
            mcp_tool: "sendmock_email_delete_all",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .email_repository
            .delete_all_emails()
            .await?;
        Ok(NoContent)
    }
}
