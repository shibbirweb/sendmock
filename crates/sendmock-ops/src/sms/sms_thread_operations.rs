use schemars::JsonSchema;
use serde::Deserialize;

use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

/// `PATCH /api/v1/sms/threads/{threadId}`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SmsThreadUpdateInput {
    /// The conversation's `thread_id`, from `GET /api/v1/sms/threads`.
    pub thread_id: String,
    /// True marks every message in the conversation read; false marks its newest message
    /// unread.
    pub is_read: bool,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SmsThreadReference {
    /// The conversation's `thread_id`, from `GET /api/v1/sms/threads`.
    pub thread_id: String,
}

pub struct UpdateSmsThreadOperation;

impl Operation for UpdateSmsThreadOperation {
    type Input = SmsThreadUpdateInput;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchSmsThreadsByThreadId",
            method: HttpMethod::Patch,
            path: "/api/v1/sms/threads/{threadId}",
            summary: "Mark a conversation read, or its newest message unread.",
            cli_usage: "sendmock sms threads update <threadId>",
            mcp_tool: "sendmock_sms_thread_update",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsThreadUpdateInput,
    ) -> Result<NoContent, OperationError> {
        let sms_repository = &operation_context.sms_repository;
        let has_messages = if input.is_read {
            sms_repository.mark_thread_read(&input.thread_id).await?
        } else {
            sms_repository.mark_thread_unread(&input.thread_id).await?
        };
        if !has_messages {
            return Err(OperationError::NotFound {
                message: format!("No conversation with id {}", input.thread_id),
            });
        }
        Ok(NoContent)
    }
}

pub struct DeleteSmsThreadOperation;

impl Operation for DeleteSmsThreadOperation {
    type Input = SmsThreadReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteSmsThreadsByThreadId",
            method: HttpMethod::Delete,
            path: "/api/v1/sms/threads/{threadId}",
            summary: "Delete a conversation with its messages.",
            is_destructive: true,
            cli_usage: "sendmock sms threads delete <threadId>",
            mcp_tool: "sendmock_sms_thread_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deleting a conversation that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsThreadReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .sms_repository
            .delete_thread(&input.thread_id)
            .await?;
        Ok(NoContent)
    }
}
