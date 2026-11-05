use sendmock_store::PaymentListFilter;

use super::payment_catalogue::{find_payment, read_payment_document};
use super::payment_method_catalogue::list_presented_methods;
use super::payment_method_views::PaymentMethodDefinition;
use super::payment_views::{PaymentDetail, PaymentListQuery, PaymentReference, PaymentSummary};
use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError, PageOf,
};

const DEFAULT_PAGE_SIZE: u32 = 50;
const MAXIMUM_PAGE_SIZE: u32 = 200;

fn read_only_payment_definition(
    operation_id: &'static str,
    path: &'static str,
    summary: &'static str,
    cli_usage: &'static str,
    mcp_tool: &'static str,
) -> OperationDefinition {
    OperationDefinition {
        operation_id,
        method: HttpMethod::Get,
        path,
        summary,
        is_read_only: true,
        cli_usage,
        mcp_tool,
        ..OperationDefinition::DEFAULTS
    }
}

fn split_statuses(status_text: Option<&str>) -> Vec<String> {
    status_text
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|status| !status.is_empty())
        .map(str::to_owned)
        .collect()
}

pub struct ListPaymentsOperation;

impl Operation for ListPaymentsOperation {
    type Input = PaymentListQuery;
    type Output = PageOf<PaymentSummary>;

    fn definition(&self) -> OperationDefinition {
        read_only_payment_definition(
            "getPayments",
            "/api/v1/payments",
            "Test payments, newest first, with filters.",
            "sendmock payments list",
            "sendmock_payment_list",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentListQuery,
    ) -> Result<PageOf<PaymentSummary>, OperationError> {
        let page_size = input
            .limit
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAXIMUM_PAGE_SIZE);
        let filter = PaymentListFilter {
            statuses: split_statuses(input.status.as_deref()),
            provider: input.provider,
            currency: input.currency.map(|currency| currency.to_ascii_uppercase()),
        };
        let page = operation_context
            .payment_repository
            .list_payments(filter, input.cursor, page_size)
            .await?;
        Ok(PageOf {
            items: page
                .payments
                .iter()
                .map(|stored_payment| {
                    read_payment_document(stored_payment).map(|payment| payment.summary)
                })
                .collect::<Result<_, _>>()?,
            next_cursor: page.next_cursor,
            total_count: page.total_count,
        })
    }
}

pub struct GetPaymentOperation;

impl Operation for GetPaymentOperation {
    type Input = PaymentReference;
    type Output = PaymentDetail;

    fn definition(&self) -> OperationDefinition {
        read_only_payment_definition(
            "getPaymentsByPaymentId",
            "/api/v1/payments/{paymentId}",
            "One payment with line items, timeline, redirects and notifications.",
            "sendmock payments show <paymentId>",
            "sendmock_payment_get",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentReference,
    ) -> Result<PaymentDetail, OperationError> {
        find_payment(operation_context, &input.payment_id).await
    }
}

pub struct ListPaymentTestValuesOperation;

impl Operation for ListPaymentTestValuesOperation {
    type Input = NoInput;
    type Output = Vec<PaymentMethodDefinition>;

    fn definition(&self) -> OperationDefinition {
        read_only_payment_definition(
            "getPaymentsTestCards",
            "/api/v1/payments/test-cards",
            "The test values of every enabled payment method.",
            "sendmock payments test-cards",
            "sendmock_payment_test_cards",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<PaymentMethodDefinition>, OperationError> {
        Ok(list_presented_methods(operation_context)
            .await?
            .into_iter()
            .filter(|payment_method| payment_method.fields.is_enabled)
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_one_or_several_statuses() {
        assert_eq!(
            split_statuses(Some("succeeded, refunded,")),
            ["succeeded", "refunded"]
        );
        assert!(split_statuses(None).is_empty());
    }
}
