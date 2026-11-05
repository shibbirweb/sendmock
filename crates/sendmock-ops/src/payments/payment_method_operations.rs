use sendmock_payments::check_payment_method;

use super::payment_method_catalogue::{
    METHOD_DEFINITION_KIND, find_flow_step_types, find_payment_method, find_shipped_method,
    load_gateway_method_keys, load_payment_methods, present_payment_method, save_payment_method,
};
use super::payment_method_views::{
    PaymentMethodDefinition, PaymentMethodFields, PaymentMethodRecord, PaymentMethodReference,
    PaymentMethodUpdate,
};
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

fn method_definition(
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

/// Checks the whole method against its flow's steps, the way the Methods screen does.
async fn check_method_fields(
    operation_context: &OperationContext,
    method_fields: &PaymentMethodFields,
    is_new: bool,
) -> Result<(), OperationError> {
    let existing_keys: Vec<String> = load_payment_methods(operation_context)
        .await?
        .into_iter()
        .map(|existing_method| existing_method.fields.key)
        .collect();
    let flow_step_types = find_flow_step_types(operation_context, &method_fields.flow).await?;
    check_payment_method(
        &method_fields.to_draft(),
        &existing_keys,
        is_new,
        flow_step_types.as_deref(),
    )
    .map_err(|method_problem| OperationError::InvalidInput {
        message: method_problem.message,
        field: Some(method_problem.field),
    })
}

async fn present_method(
    operation_context: &OperationContext,
    payment_method: PaymentMethodRecord,
) -> Result<PaymentMethodDefinition, OperationError> {
    let gateway_method_keys = load_gateway_method_keys(operation_context).await?;
    Ok(present_payment_method(payment_method, &gateway_method_keys))
}

pub struct ListPaymentMethodsOperation;

impl Operation for ListPaymentMethodsOperation {
    type Input = NoInput;
    type Output = Vec<PaymentMethodDefinition>;

    fn definition(&self) -> OperationDefinition {
        method_definition(
            "getPaymentsMethods",
            HttpMethod::Get,
            "/api/v1/payments/methods",
            "Methods customers pay with, and their test values.",
            "sendmock payments methods list",
            "sendmock_payment_method_list",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<PaymentMethodDefinition>, OperationError> {
        let gateway_method_keys = load_gateway_method_keys(operation_context).await?;
        Ok(load_payment_methods(operation_context)
            .await?
            .into_iter()
            .map(|payment_method| present_payment_method(payment_method, &gateway_method_keys))
            .collect())
    }
}

pub struct GetPaymentMethodOperation;

impl Operation for GetPaymentMethodOperation {
    type Input = PaymentMethodReference;
    type Output = PaymentMethodDefinition;

    fn definition(&self) -> OperationDefinition {
        method_definition(
            "getPaymentsMethodsByMethodKey",
            HttpMethod::Get,
            "/api/v1/payments/methods/{methodKey}",
            "One payment method with its test values.",
            "sendmock payments methods show <methodKey>",
            "sendmock_payment_method_get",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentMethodReference,
    ) -> Result<PaymentMethodDefinition, OperationError> {
        let payment_method = find_payment_method(operation_context, &input.method_key).await?;
        present_method(operation_context, payment_method).await
    }
}

pub struct CreatePaymentMethodOperation;

impl Operation for CreatePaymentMethodOperation {
    type Input = PaymentMethodFields;
    type Output = PaymentMethodDefinition;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            ..method_definition(
                "postPaymentsMethods",
                HttpMethod::Post,
                "/api/v1/payments/methods",
                "Add a custom method.",
                "sendmock payments methods create",
                "sendmock_payment_method_create",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentMethodFields,
    ) -> Result<PaymentMethodDefinition, OperationError> {
        check_method_fields(operation_context, &input, true).await?;
        let new_method = PaymentMethodRecord {
            fields: input,
            is_builtin: false,
        };
        save_payment_method(operation_context, &new_method).await?;
        present_method(operation_context, new_method).await
    }
}

pub struct UpdatePaymentMethodOperation;

impl Operation for UpdatePaymentMethodOperation {
    type Input = PaymentMethodUpdate;
    type Output = PaymentMethodDefinition;

    fn definition(&self) -> OperationDefinition {
        method_definition(
            "patchPaymentsMethodsByMethodKey",
            HttpMethod::Patch,
            "/api/v1/payments/methods/{methodKey}",
            "Change a method.",
            "sendmock payments methods update <methodKey>",
            "sendmock_payment_method_update",
        )
    }

    /// The key and flow in the body are ignored: both are fixed after creation.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentMethodUpdate,
    ) -> Result<PaymentMethodDefinition, OperationError> {
        let stored_method = find_payment_method(operation_context, &input.method_key).await?;
        let changed_fields = PaymentMethodFields {
            key: stored_method.fields.key.clone(),
            flow: stored_method.fields.flow.clone(),
            ..input.changes
        };
        check_method_fields(operation_context, &changed_fields, false).await?;
        let changed_method = PaymentMethodRecord {
            fields: changed_fields,
            ..stored_method
        };
        save_payment_method(operation_context, &changed_method).await?;
        present_method(operation_context, changed_method).await
    }
}

pub struct DeletePaymentMethodOperation;

impl Operation for DeletePaymentMethodOperation {
    type Input = PaymentMethodReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_destructive: true,
            success_status: SuccessStatus::NoContent,
            ..method_definition(
                "deletePaymentsMethodsByMethodKey",
                HttpMethod::Delete,
                "/api/v1/payments/methods/{methodKey}",
                "Delete a custom method; 409 while a gateway offers it.",
                "sendmock payments methods delete <methodKey>",
                "sendmock_payment_method_delete",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentMethodReference,
    ) -> Result<NoContent, OperationError> {
        let payment_method = find_payment_method(operation_context, &input.method_key).await?;
        let presented_method = present_method(operation_context, payment_method).await?;
        if presented_method.is_builtin {
            return Err(OperationError::Conflict {
                code: "builtin_method",
                message: "Built-in methods cannot be deleted; disable it instead".to_owned(),
            });
        }
        if !presented_method.gateway_keys.is_empty() {
            return Err(OperationError::Conflict {
                code: "method_offered",
                message: format!(
                    "{} is offered by {}; take it out of those gateways first",
                    presented_method.fields.name,
                    presented_method.gateway_keys.join(", ")
                ),
            });
        }
        operation_context
            .payment_definition_repository
            .delete_definition(METHOD_DEFINITION_KIND, &input.method_key)
            .await?;
        Ok(NoContent)
    }
}

pub struct ResetPaymentMethodOperation;

impl Operation for ResetPaymentMethodOperation {
    type Input = PaymentMethodReference;
    type Output = PaymentMethodDefinition;

    fn definition(&self) -> OperationDefinition {
        method_definition(
            "postPaymentsMethodsByMethodKeyReset",
            HttpMethod::Post,
            "/api/v1/payments/methods/{methodKey}/reset",
            "Put a built-in method back as shipped.",
            "sendmock payments methods reset <methodKey>",
            "sendmock_payment_method_reset",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentMethodReference,
    ) -> Result<PaymentMethodDefinition, OperationError> {
        find_payment_method(operation_context, &input.method_key).await?;
        let Some(shipped_method) = find_shipped_method(&input.method_key) else {
            return Err(OperationError::Conflict {
                code: "not_builtin",
                message: "Only built-in methods have a default to go back to".to_owned(),
            });
        };
        operation_context
            .payment_definition_repository
            .delete_definition(METHOD_DEFINITION_KIND, &input.method_key)
            .await?;
        present_method(operation_context, shipped_method).await
    }
}
