use sendmock_store::WebhookDeliveryFilter;

use crate::events::publish_traffic_cleared;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus, publish_email_deleted,
};

/// What `traffic.cleared` names after a delete of everything.
const EVERY_TRAFFIC_KIND: [&str; 10] = [
    "email",
    "sms",
    "verification",
    "push",
    "http_request",
    "webhook_delivery",
    "payment",
    "subscription",
    "smtp_session",
    "api_request",
];

pub struct DeleteAllTrafficOperation;

impl Operation for DeleteAllTrafficOperation {
    type Input = NoInput;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteTraffic",
            method: HttpMethod::Delete,
            path: "/api/v1/traffic",
            summary: "Delete every captured item in every project and keep every setting and configuration list.",
            is_destructive: true,
            cli_usage: "sendmock traffic delete-all --yes",
            mcp_tool: "sendmock_traffic_delete_all",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Unlike reset, the settings and configuration stay, captured HTTP requests go too, and
    /// webhook deliveries still queued or waiting for a retry stay with the dispatcher.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<NoContent, OperationError> {
        let deleted_email_count = operation_context
            .email_repository
            .delete_all_emails()
            .await?;
        let deleted_other_count = delete_message_traffic(operation_context).await?
            + delete_logged_traffic(operation_context).await?;
        if deleted_email_count > 0 {
            publish_email_deleted(operation_context, None, deleted_email_count);
        }
        publish_traffic_cleared(
            operation_context,
            &EVERY_TRAFFIC_KIND,
            None,
            deleted_email_count + deleted_other_count,
        );
        Ok(NoContent)
    }
}

/// SMS with their WhatsApp media, verifications, push notifications, captured HTTP requests,
/// payments and subscriptions; answers how many items went.
async fn delete_message_traffic(
    operation_context: &OperationContext,
) -> Result<u64, OperationError> {
    let deleted_sms_count = operation_context
        .sms_repository
        .delete_all_messages(None)
        .await?;
    operation_context
        .sms_repository
        .whatsapp_media()
        .delete_all_media()
        .await?;
    let deleted_verification_count = operation_context
        .verification_repository
        .delete_all_verifications()
        .await?;
    let deleted_push_count = operation_context
        .push_notifications
        .delete_notifications(None)
        .await?;
    let deleted_request_count = operation_context
        .http_catcher_stores
        .requests
        .delete_requests(None)
        .await?;
    let deleted_payment_count = operation_context
        .payment_repository
        .delete_all_payments()
        .await?;
    let deleted_subscription_count = operation_context
        .payment_stores
        .subscriptions
        .delete_all_subscriptions()
        .await?;
    Ok(deleted_sms_count
        + deleted_verification_count
        + deleted_push_count
        + u64::try_from(deleted_request_count).unwrap_or_default()
        + deleted_payment_count
        + deleted_subscription_count)
}

/// Finished webhook deliveries, SMTP sessions and the API request log; answers how many went.
async fn delete_logged_traffic(
    operation_context: &OperationContext,
) -> Result<u64, OperationError> {
    let deleted_delivery_count = operation_context
        .webhook_delivery_repository
        .delete_finished_deliveries(WebhookDeliveryFilter::default())
        .await?;
    let deleted_session_count = operation_context
        .logs
        .smtp_sessions
        .delete_all_sessions()
        .await?;
    let deleted_api_request_count = operation_context
        .logs
        .api_requests
        .delete_all_requests()
        .await?;
    Ok(deleted_delivery_count + deleted_session_count + deleted_api_request_count)
}
