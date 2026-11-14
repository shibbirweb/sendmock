use super::app_settings::AppSettings;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus, publish_email_deleted, restore_seed_state,
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

    /// Deletes all traffic, puts the settings back to their defaults, then restores the seed
    /// applied last: its items as the file has them, and the configuration it does not hold
    /// deleted. Without a seed, configuration such as numbers, services and outcome rules stays.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<NoContent, OperationError> {
        let deleted_email_count = delete_all_traffic(operation_context).await?;
        operation_context
            .settings_store
            .save(
                AppSettings::default(),
                operation_context.clock.now_unix_ms(),
            )
            .await?;
        restore_seed_state(operation_context).await?;
        if deleted_email_count > 0 {
            publish_email_deleted(operation_context, None, deleted_email_count);
        }
        Ok(NoContent)
    }
}

/// Every email, SMS, verification, push notification, SMTP session, logged request, webhook
/// delivery and payment; answers how many emails went, for `email.deleted`.
async fn delete_all_traffic(operation_context: &OperationContext) -> Result<u64, OperationError> {
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
        .push_notifications
        .delete_notifications(None)
        .await?;
    operation_context
        .sms_repository
        .whatsapp_media()
        .delete_all_media()
        .await?;
    operation_context
        .logs
        .smtp_sessions
        .delete_all_sessions()
        .await?;
    operation_context
        .logs
        .api_requests
        .delete_all_requests()
        .await?;
    operation_context
        .webhook_delivery_repository
        .delete_all_deliveries()
        .await?;
    operation_context
        .payment_repository
        .delete_all_payments()
        .await?;
    operation_context
        .payment_stores
        .subscriptions
        .delete_all_subscriptions()
        .await?;
    Ok(deleted_email_count)
}
