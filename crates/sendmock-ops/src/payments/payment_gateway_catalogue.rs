use super::payment_definition_store::{GATEWAY_DEFINITION_KIND, load_definitions, save_definition};
use super::payment_gateway_views::{PaymentGatewayDefinition, PaymentGatewayRecord};
use crate::message_providers::mask_secret_credentials;
use crate::{OperationContext, OperationError};

/// Exported from the mock by `web/scripts/export-builtin-definitions.ts`.
const BUILTIN_GATEWAYS_JSON: &str = include_str!("../../builtin/payment-gateways.json");

/// What a blank custom gateway starts from.
const BLANK_GATEWAY_KEY: &str = "native";

impl super::payment_definition_store::PaymentDefinition for PaymentGatewayRecord {
    fn definition_key(&self) -> &str {
        &self.fields.key
    }

    fn is_builtin(&self) -> bool {
        self.is_builtin
    }
}

pub fn builtin_payment_gateways() -> Vec<PaymentGatewayRecord> {
    serde_json::from_str(BUILTIN_GATEWAYS_JSON).unwrap_or_default()
}

pub fn find_shipped_gateway(gateway_key: &str) -> Option<PaymentGatewayRecord> {
    builtin_payment_gateways()
        .into_iter()
        .find(|shipped_gateway| shipped_gateway.fields.key == gateway_key)
}

pub fn blank_gateway() -> Option<PaymentGatewayRecord> {
    find_shipped_gateway(BLANK_GATEWAY_KEY)
}

pub async fn load_payment_gateways(
    operation_context: &OperationContext,
) -> Result<Vec<PaymentGatewayRecord>, OperationError> {
    load_definitions(
        operation_context,
        GATEWAY_DEFINITION_KIND,
        builtin_payment_gateways(),
    )
    .await
}

pub async fn find_payment_gateway(
    operation_context: &OperationContext,
    gateway_key: &str,
) -> Result<PaymentGatewayRecord, OperationError> {
    load_payment_gateways(operation_context)
        .await?
        .into_iter()
        .find(|payment_gateway| payment_gateway.fields.key == gateway_key)
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No payment gateway with the key {gateway_key}"),
        })
}

/// Each gateway's key and the methods it offers.
pub async fn load_gateway_method_keys(
    operation_context: &OperationContext,
) -> Result<Vec<(String, Vec<String>)>, OperationError> {
    Ok(load_payment_gateways(operation_context)
        .await?
        .into_iter()
        .map(|payment_gateway| {
            (
                payment_gateway.fields.key,
                payment_gateway.fields.method_keys,
            )
        })
        .collect())
}

/// A gateway with secrets masked, whether it differs from its shipped version, and how many
/// payments used it (payments come with W3, so none yet).
pub fn present_payment_gateway(payment_gateway: PaymentGatewayRecord) -> PaymentGatewayDefinition {
    let is_modified = payment_gateway.is_builtin
        && find_shipped_gateway(&payment_gateway.fields.key)
            .is_some_and(|shipped_gateway| shipped_gateway.fields != payment_gateway.fields);
    let mut fields = payment_gateway.fields;
    fields.credentials = mask_secret_credentials(&fields.credentials);
    PaymentGatewayDefinition {
        fields,
        is_builtin: payment_gateway.is_builtin,
        is_modified,
        payment_count: 0,
    }
}

pub async fn save_payment_gateway(
    operation_context: &OperationContext,
    payment_gateway: &PaymentGatewayRecord,
) -> Result<(), OperationError> {
    save_definition(operation_context, GATEWAY_DEFINITION_KIND, payment_gateway).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_shipped_gateways_parse_with_their_methods() {
        let gateway_keys: Vec<String> = builtin_payment_gateways()
            .into_iter()
            .map(|payment_gateway| payment_gateway.fields.key)
            .collect();
        assert_eq!(
            gateway_keys,
            ["stripe", "paypal", "sslcommerz", "bkash", "native"]
        );
        assert!(blank_gateway().is_some());
    }
}
