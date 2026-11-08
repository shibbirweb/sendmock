use sendmock_payments::check_payment_flow;

use super::payment_definition_store::{FLOW_DEFINITION_KIND, delete_definition};
use super::payment_flow_catalogue::{
    find_payment_flow, find_shipped_flow, load_method_flow_keys, load_payment_flows,
    present_payment_flow, present_with_usage, save_payment_flow,
};
use super::payment_flow_views::{
    PaymentFlowDefinition, PaymentFlowInput, PaymentFlowRecord, PaymentFlowReference,
    PaymentFlowUpdate,
};
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

fn flow_definition(
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
        is_read_only: method == HttpMethod::Get,
        cli_usage,
        mcp_tool,
        ..OperationDefinition::DEFAULTS
    }
}

/// Checks the whole flow the way the Flows screen does, before anything is stored.
pub async fn check_flow_record(
    operation_context: &OperationContext,
    payment_flow: &PaymentFlowRecord,
    is_new: bool,
) -> Result<(), OperationError> {
    let existing_keys: Vec<String> = load_payment_flows(operation_context)
        .await?
        .into_iter()
        .map(|existing_flow| existing_flow.key)
        .collect();
    check_payment_flow(&payment_flow.to_draft(), &existing_keys, is_new).map_err(|flow_problem| {
        OperationError::InvalidInput {
            message: flow_problem.message,
            field: Some(flow_problem.field),
        }
    })
}

pub struct ListPaymentFlowsOperation;

impl Operation for ListPaymentFlowsOperation {
    type Input = NoInput;
    type Output = Vec<PaymentFlowDefinition>;

    fn definition(&self) -> OperationDefinition {
        flow_definition(
            "getPaymentsFlows",
            HttpMethod::Get,
            "/api/v1/payments/flows",
            "Flows: the steps a checkout page runs for a method.",
            "sendmock payments flows list",
            "sendmock_payment_flow_list",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<PaymentFlowDefinition>, OperationError> {
        let method_flow_keys = load_method_flow_keys(operation_context).await?;
        Ok(load_payment_flows(operation_context)
            .await?
            .into_iter()
            .map(|payment_flow| present_with_usage(payment_flow, &method_flow_keys))
            .collect())
    }
}

pub struct GetPaymentFlowOperation;

impl Operation for GetPaymentFlowOperation {
    type Input = PaymentFlowReference;
    type Output = PaymentFlowDefinition;

    fn definition(&self) -> OperationDefinition {
        flow_definition(
            "getPaymentsFlowsByFlowKey",
            HttpMethod::Get,
            "/api/v1/payments/flows/{flowKey}",
            "One payment flow with its steps.",
            "sendmock payments flows show <flowKey>",
            "sendmock_payment_flow_get",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentFlowReference,
    ) -> Result<PaymentFlowDefinition, OperationError> {
        let payment_flow = find_payment_flow(operation_context, &input.flow_key).await?;
        present_payment_flow(operation_context, payment_flow).await
    }
}

pub struct CreatePaymentFlowOperation;

impl Operation for CreatePaymentFlowOperation {
    type Input = PaymentFlowInput;
    type Output = PaymentFlowDefinition;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            ..flow_definition(
                "postPaymentsFlows",
                HttpMethod::Post,
                "/api/v1/payments/flows",
                "Add a flow.",
                "sendmock payments flows create",
                "sendmock_payment_flow_create",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentFlowInput,
    ) -> Result<PaymentFlowDefinition, OperationError> {
        let new_flow = PaymentFlowRecord {
            key: input.key,
            name: input.name,
            picker_tab: input.picker_tab,
            steps: input.steps,
            is_builtin: false,
        };
        check_flow_record(operation_context, &new_flow, true).await?;
        save_payment_flow(operation_context, &new_flow).await?;
        present_payment_flow(operation_context, new_flow).await
    }
}

pub struct UpdatePaymentFlowOperation;

impl Operation for UpdatePaymentFlowOperation {
    type Input = PaymentFlowUpdate;
    type Output = PaymentFlowDefinition;

    fn definition(&self) -> OperationDefinition {
        flow_definition(
            "patchPaymentsFlowsByFlowKey",
            HttpMethod::Patch,
            "/api/v1/payments/flows/{flowKey}",
            "Change a flow.",
            "sendmock payments flows update <flowKey>",
            "sendmock_payment_flow_update",
        )
    }

    /// The key in the body is ignored: a flow's key is fixed after creation.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentFlowUpdate,
    ) -> Result<PaymentFlowDefinition, OperationError> {
        let stored_flow = find_payment_flow(operation_context, &input.flow_key).await?;
        let changed_flow = PaymentFlowRecord {
            name: input.changes.name,
            picker_tab: input.changes.picker_tab,
            steps: input.changes.steps,
            ..stored_flow
        };
        check_flow_record(operation_context, &changed_flow, false).await?;
        save_payment_flow(operation_context, &changed_flow).await?;
        present_payment_flow(operation_context, changed_flow).await
    }
}

pub struct DeletePaymentFlowOperation;

impl Operation for DeletePaymentFlowOperation {
    type Input = PaymentFlowReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_destructive: true,
            success_status: SuccessStatus::NoContent,
            ..flow_definition(
                "deletePaymentsFlowsByFlowKey",
                HttpMethod::Delete,
                "/api/v1/payments/flows/{flowKey}",
                "Delete a custom flow; 409 while a method uses it.",
                "sendmock payments flows delete <flowKey>",
                "sendmock_payment_flow_delete",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentFlowReference,
    ) -> Result<NoContent, OperationError> {
        let payment_flow = find_payment_flow(operation_context, &input.flow_key).await?;
        let presented_flow = present_payment_flow(operation_context, payment_flow).await?;
        if presented_flow.is_builtin {
            return Err(OperationError::Conflict {
                code: "builtin_flow",
                message: "Built-in flows cannot be deleted; reset it to default instead".to_owned(),
            });
        }
        if presented_flow.method_count > 0 {
            return Err(OperationError::Conflict {
                code: "flow_in_use",
                message: format!(
                    "{} methods use {}; delete those methods first",
                    presented_flow.method_count, presented_flow.name
                ),
            });
        }
        delete_definition(operation_context, FLOW_DEFINITION_KIND, &input.flow_key).await?;
        Ok(NoContent)
    }
}

pub struct ResetPaymentFlowOperation;

impl Operation for ResetPaymentFlowOperation {
    type Input = PaymentFlowReference;
    type Output = PaymentFlowDefinition;

    fn definition(&self) -> OperationDefinition {
        flow_definition(
            "postPaymentsFlowsByFlowKeyReset",
            HttpMethod::Post,
            "/api/v1/payments/flows/{flowKey}/reset",
            "Put a built-in flow back as shipped.",
            "sendmock payments flows reset <flowKey>",
            "sendmock_payment_flow_reset",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentFlowReference,
    ) -> Result<PaymentFlowDefinition, OperationError> {
        find_payment_flow(operation_context, &input.flow_key).await?;
        let Some(shipped_flow) = find_shipped_flow(&input.flow_key) else {
            return Err(OperationError::Conflict {
                code: "not_builtin",
                message: "Only built-in flows have a default to go back to".to_owned(),
            });
        };
        delete_definition(operation_context, FLOW_DEFINITION_KIND, &input.flow_key).await?;
        present_payment_flow(operation_context, shipped_flow).await
    }
}
