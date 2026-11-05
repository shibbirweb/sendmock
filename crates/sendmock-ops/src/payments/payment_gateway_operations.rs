use sendmock_payments::{check_new_gateway, check_payment_gateway};

use super::payment_gateway_catalogue::{
    blank_gateway, find_payment_gateway, load_payment_gateways, present_payment_gateway,
    save_payment_gateway,
};
use super::payment_gateway_views::{
    PaymentGatewayCreateRequest, PaymentGatewayDefinition, PaymentGatewayFields,
    PaymentGatewayRecord, PaymentGatewayReference, PaymentGatewayUpdate,
};
use super::payment_method_catalogue::load_payment_methods;
use crate::message_providers::merge_credentials;
use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

pub(super) fn gateway_definition(
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

fn invalid_field(field: String, message: String) -> OperationError {
    OperationError::InvalidInput {
        message,
        field: Some(field),
    }
}

/// The gateway's rules, and every method it offers must exist.
async fn check_gateway_fields(
    operation_context: &OperationContext,
    gateway_fields: &PaymentGatewayFields,
) -> Result<(), OperationError> {
    check_payment_gateway(&gateway_fields.to_draft())
        .map_err(|gateway_problem| invalid_field(gateway_problem.field, gateway_problem.message))?;
    let method_keys: Vec<String> = load_payment_methods(operation_context)
        .await?
        .into_iter()
        .map(|payment_method| payment_method.fields.key)
        .collect();
    if let Some(unknown_key) = gateway_fields
        .method_keys
        .iter()
        .find(|method_key| !method_keys.contains(method_key))
    {
        return Err(invalid_field(
            "method_keys".to_owned(),
            format!("There is no method with the key {unknown_key}"),
        ));
    }
    Ok(())
}

pub struct ListPaymentGatewaysOperation;

impl Operation for ListPaymentGatewaysOperation {
    type Input = NoInput;
    type Output = Vec<PaymentGatewayDefinition>;

    fn definition(&self) -> OperationDefinition {
        gateway_definition(
            "getPaymentsGateways",
            HttpMethod::Get,
            "/api/v1/payments/gateways",
            "Gateways with their checkout, redirect and notification setup.",
            "sendmock payments gateways list",
            "sendmock_payment_gateway_list",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<PaymentGatewayDefinition>, OperationError> {
        Ok(load_payment_gateways(operation_context)
            .await?
            .into_iter()
            .map(present_payment_gateway)
            .collect())
    }
}

pub struct GetPaymentGatewayOperation;

impl Operation for GetPaymentGatewayOperation {
    type Input = PaymentGatewayReference;
    type Output = PaymentGatewayDefinition;

    fn definition(&self) -> OperationDefinition {
        gateway_definition(
            "getPaymentsGatewaysByGatewayKey",
            HttpMethod::Get,
            "/api/v1/payments/gateways/{gatewayKey}",
            "One gateway definition; secret credentials masked.",
            "sendmock payments gateways show <gatewayKey>",
            "sendmock_payment_gateway_get",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentGatewayReference,
    ) -> Result<PaymentGatewayDefinition, OperationError> {
        Ok(present_payment_gateway(
            find_payment_gateway(operation_context, &input.gateway_key).await?,
        ))
    }
}

pub struct CreatePaymentGatewayOperation;

impl Operation for CreatePaymentGatewayOperation {
    type Input = PaymentGatewayCreateRequest;
    type Output = PaymentGatewayDefinition;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            ..gateway_definition(
                "postPaymentsGateways",
                HttpMethod::Post,
                "/api/v1/payments/gateways",
                "Add a custom gateway.",
                "sendmock payments gateways create",
                "sendmock_payment_gateway_create",
            )
        }
    }

    /// Copies the gateway it starts from (methods, redirect and notification); a blank one
    /// starts from Native and offers cards.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentGatewayCreateRequest,
    ) -> Result<PaymentGatewayDefinition, OperationError> {
        let existing_keys: Vec<String> = load_payment_gateways(operation_context)
            .await?
            .into_iter()
            .map(|payment_gateway| payment_gateway.fields.key)
            .collect();
        check_new_gateway(&input.key, &input.name, &existing_keys).map_err(|gateway_problem| {
            invalid_field(gateway_problem.field, gateway_problem.message)
        })?;
        let starting_gateway = match &input.start_from {
            Some(start_key) => find_payment_gateway(operation_context, start_key).await?,
            None => blank_gateway().ok_or_else(|| {
                OperationError::Internal("the shipped Native gateway is missing".to_owned())
            })?,
        };
        let mut fields = starting_gateway.fields;
        if input.start_from.is_none() {
            fields.method_keys = vec!["card".to_owned()];
        }
        let new_gateway = PaymentGatewayRecord {
            fields: PaymentGatewayFields {
                key: input.key,
                name: input.name.trim().to_owned(),
                is_enabled: true,
                ..fields
            },
            is_builtin: false,
        };
        save_payment_gateway(operation_context, &new_gateway).await?;
        Ok(present_payment_gateway(new_gateway))
    }
}

pub struct UpdatePaymentGatewayOperation;

impl Operation for UpdatePaymentGatewayOperation {
    type Input = PaymentGatewayUpdate;
    type Output = PaymentGatewayDefinition;

    fn definition(&self) -> OperationDefinition {
        gateway_definition(
            "patchPaymentsGatewaysByGatewayKey",
            HttpMethod::Patch,
            "/api/v1/payments/gateways/{gatewayKey}",
            "Change a gateway; secret credentials stay masked.",
            "sendmock payments gateways update <gatewayKey>",
            "sendmock_payment_gateway_update",
        )
    }

    /// The key in the body is ignored; a secret sent back masked or empty keeps its value.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentGatewayUpdate,
    ) -> Result<PaymentGatewayDefinition, OperationError> {
        let stored_gateway = find_payment_gateway(operation_context, &input.gateway_key).await?;
        let changed_fields = PaymentGatewayFields {
            key: stored_gateway.fields.key.clone(),
            credentials: merge_credentials(
                &stored_gateway.fields.credentials,
                input.changes.credentials.clone(),
            ),
            ..input.changes
        };
        check_gateway_fields(operation_context, &changed_fields).await?;
        let changed_gateway = PaymentGatewayRecord {
            fields: changed_fields,
            ..stored_gateway
        };
        save_payment_gateway(operation_context, &changed_gateway).await?;
        Ok(present_payment_gateway(changed_gateway))
    }
}
