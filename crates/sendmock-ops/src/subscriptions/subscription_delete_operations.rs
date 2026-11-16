use super::subscription_views::SubscriptionPathInput;
use crate::events::publish_traffic_cleared;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

pub struct DeleteSubscriptionOperation;

impl Operation for DeleteSubscriptionOperation {
    type Input = SubscriptionPathInput;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deletePaymentsSubscriptionsBySubscriptionId",
            method: HttpMethod::Delete,
            path: "/api/v1/payments/subscriptions/{subscriptionId}",
            summary: "Delete one subscription; its past payments stay.",
            is_destructive: true,
            cli_usage: "sendmock payments subscriptions delete <subscriptionId>",
            mcp_tool: "sendmock_subscription_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deleting a subscription that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SubscriptionPathInput,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .payment_stores
            .subscriptions
            .delete_subscription(&input.subscription_id)
            .await?;
        Ok(NoContent)
    }
}

pub struct DeleteSubscriptionsOperation;

impl Operation for DeleteSubscriptionsOperation {
    type Input = NoInput;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deletePaymentsSubscriptions",
            method: HttpMethod::Delete,
            path: "/api/v1/payments/subscriptions",
            summary: "Delete every subscription; their past payments stay.",
            is_destructive: true,
            cli_usage: "sendmock payments subscriptions delete-all --yes",
            mcp_tool: "sendmock_subscription_delete_all",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<NoContent, OperationError> {
        let deleted_count = operation_context
            .payment_stores
            .subscriptions
            .delete_all_subscriptions()
            .await?;
        publish_traffic_cleared(operation_context, &["subscription"], None, deleted_count);
        Ok(NoContent)
    }
}
