use sendmock_store::PaymentListFilter;

use super::payment_operations::split_statuses;
use super::payment_views::{PaymentFilterQuery, PaymentReference};
use crate::events::publish_traffic_cleared;
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

pub struct DeletePaymentOperation;

impl Operation for DeletePaymentOperation {
    type Input = PaymentReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deletePaymentsByPaymentId",
            method: HttpMethod::Delete,
            path: "/api/v1/payments/{paymentId}",
            summary: "Delete one payment with its events, refunds and checkout session.",
            is_destructive: true,
            cli_usage: "sendmock payments delete <paymentId>",
            mcp_tool: "sendmock_payment_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deleting a payment that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .payment_repository
            .delete_payment(&input.payment_id)
            .await?;
        Ok(NoContent)
    }
}

pub struct DeletePaymentsOperation;

impl Operation for DeletePaymentsOperation {
    type Input = PaymentFilterQuery;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deletePayments",
            method: HttpMethod::Delete,
            path: "/api/v1/payments",
            summary: "Delete every payment, or those the filters match, with their events, refunds and checkout sessions.",
            is_destructive: true,
            cli_usage: "sendmock payments delete-all --yes",
            mcp_tool: "sendmock_payment_delete_all",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentFilterQuery,
    ) -> Result<NoContent, OperationError> {
        let deleted_count = operation_context
            .payment_repository
            .delete_matching_payments(PaymentListFilter {
                statuses: split_statuses(input.status.as_deref()),
                provider: input.provider,
                currency: input.currency.map(|currency| currency.to_ascii_uppercase()),
            })
            .await?;
        publish_traffic_cleared(operation_context, &["payment"], None, deleted_count);
        Ok(NoContent)
    }
}
