use super::payment_definition_store::{GATEWAY_DEFINITION_KIND, delete_definition};
use super::payment_gateway_catalogue::{
    find_payment_gateway, find_shipped_gateway, present_gateway,
};
use super::payment_gateway_operations::gateway_definition;
use super::payment_gateway_views::{
    GatewayCredentialReference, GatewayCredentialReveal, PaymentGatewayDefinition,
    PaymentGatewayReference,
};
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

pub struct DeletePaymentGatewayOperation;

impl Operation for DeletePaymentGatewayOperation {
    type Input = PaymentGatewayReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_destructive: true,
            success_status: SuccessStatus::NoContent,
            ..gateway_definition(
                "deletePaymentsGatewaysByGatewayKey",
                HttpMethod::Delete,
                "/api/v1/payments/gateways/{gatewayKey}",
                "Delete a custom gateway; 409 while payments use it.",
                "sendmock payments gateways delete <gatewayKey>",
                "sendmock_payment_gateway_delete",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentGatewayReference,
    ) -> Result<NoContent, OperationError> {
        let presented_gateway = present_gateway(
            operation_context,
            find_payment_gateway(operation_context, &input.gateway_key).await?,
        )
        .await?;
        if presented_gateway.is_builtin {
            return Err(OperationError::Conflict {
                code: "builtin_gateway",
                message: "Built-in gateways cannot be deleted; disable it instead".to_owned(),
            });
        }
        if presented_gateway.payment_count > 0 {
            return Err(OperationError::Conflict {
                code: "gateway_in_use",
                message: format!(
                    "{} payments used {}; disable it instead",
                    presented_gateway.payment_count, presented_gateway.fields.name
                ),
            });
        }
        delete_definition(
            operation_context,
            GATEWAY_DEFINITION_KIND,
            &input.gateway_key,
        )
        .await?;
        Ok(NoContent)
    }
}

pub struct ResetPaymentGatewayOperation;

impl Operation for ResetPaymentGatewayOperation {
    type Input = PaymentGatewayReference;
    type Output = PaymentGatewayDefinition;

    fn definition(&self) -> OperationDefinition {
        gateway_definition(
            "postPaymentsGatewaysByGatewayKeyReset",
            HttpMethod::Post,
            "/api/v1/payments/gateways/{gatewayKey}/reset",
            "Put a built-in gateway back as shipped.",
            "sendmock payments gateways reset <gatewayKey>",
            "sendmock_payment_gateway_reset",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentGatewayReference,
    ) -> Result<PaymentGatewayDefinition, OperationError> {
        find_payment_gateway(operation_context, &input.gateway_key).await?;
        let Some(shipped_gateway) = find_shipped_gateway(&input.gateway_key) else {
            return Err(OperationError::Conflict {
                code: "not_builtin",
                message: "Only built-in gateways have a default to go back to".to_owned(),
            });
        };
        delete_definition(
            operation_context,
            GATEWAY_DEFINITION_KIND,
            &input.gateway_key,
        )
        .await?;
        present_gateway(operation_context, shipped_gateway).await
    }
}

pub struct RevealGatewayCredentialOperation;

impl Operation for RevealGatewayCredentialOperation {
    type Input = GatewayCredentialReference;
    type Output = GatewayCredentialReveal;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            revealed_secret_field: Some("value"),
            ..gateway_definition(
                "getPaymentsGatewaysByGatewayKeyCredentialsByCredentialName",
                HttpMethod::Get,
                "/api/v1/payments/gateways/{gatewayKey}/credentials/{credentialName}",
                "Reveal one secret credential (asked for after a confirmation).",
                "sendmock payments gateways credential <gatewayKey> <credentialName> --reveal",
                "",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: GatewayCredentialReference,
    ) -> Result<GatewayCredentialReveal, OperationError> {
        let payment_gateway = find_payment_gateway(operation_context, &input.gateway_key).await?;
        payment_gateway
            .fields
            .credentials
            .into_iter()
            .find(|credential| credential.name == input.credential_name)
            .map(|credential| GatewayCredentialReveal {
                name: credential.name,
                value: credential.value,
            })
            .ok_or_else(|| OperationError::NotFound {
                message: format!(
                    "{} has no credential named {}",
                    payment_gateway.fields.name, input.credential_name
                ),
            })
    }
}
