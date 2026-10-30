use super::app_settings::AppSettings;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus, publish_email_deleted,
};

pub struct ResetOperation;

impl Operation for ResetOperation {
    type Input = NoInput;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postReset",
            method: HttpMethod::Post,
            path: "/api/v1/reset",
            summary: "Delete all traffic and restore the seed configuration.",
            is_destructive: true,
            cli_usage: "sendmock reset --yes",
            mcp_tool: "sendmock_reset",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deletes every email, SMS, verification, SMTP session, logged request and webhook
    /// delivery and puts the settings back to their defaults; configuration such as numbers,
    /// services, outcome rules and saved deliveries stays. Applying the seed file again comes
    /// with seed apply in Phase 3.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<NoContent, OperationError> {
        let deleted_email_count = operation_context
            .email_repository
            .delete_all_emails()
            .await?;
        operation_context
            .sms_repository
            .delete_all_messages()
            .await?;
        operation_context
            .verification_repository
            .delete_all_verifications()
            .await?;
        operation_context
            .smtp_session_repository
            .delete_all_sessions()
            .await?;
        operation_context
            .api_request_repository
            .delete_all_requests()
            .await?;
        operation_context
            .webhook_delivery_repository
            .delete_all_deliveries()
            .await?;
        operation_context
            .settings_store
            .save(
                AppSettings::default(),
                operation_context.clock.now_unix_ms(),
            )
            .await?;
        if deleted_email_count > 0 {
            publish_email_deleted(operation_context, None, deleted_email_count);
        }
        Ok(NoContent)
    }
}
