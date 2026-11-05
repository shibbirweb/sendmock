use sendmock_payments::PaymentStepType;

use super::payment_definition_store::{METHOD_DEFINITION_KIND, load_definitions, save_definition};
use super::payment_flow_catalogue::load_payment_flows;
use super::payment_method_views::{PaymentMethodDefinition, PaymentMethodRecord};
use crate::{OperationContext, OperationError};

/// Exported from the mock by `web/scripts/export-builtin-definitions.ts`.
const BUILTIN_METHODS_JSON: &str = include_str!("../../builtin/payment-methods.json");

pub fn builtin_payment_methods() -> Vec<PaymentMethodRecord> {
    serde_json::from_str(BUILTIN_METHODS_JSON).unwrap_or_default()
}

pub fn find_shipped_method(method_key: &str) -> Option<PaymentMethodRecord> {
    builtin_payment_methods()
        .into_iter()
        .find(|shipped_method| shipped_method.fields.key == method_key)
}

pub async fn load_payment_methods(
    operation_context: &OperationContext,
) -> Result<Vec<PaymentMethodRecord>, OperationError> {
    load_definitions(
        operation_context,
        METHOD_DEFINITION_KIND,
        builtin_payment_methods(),
    )
    .await
}

pub async fn find_payment_method(
    operation_context: &OperationContext,
    method_key: &str,
) -> Result<PaymentMethodRecord, OperationError> {
    load_payment_methods(operation_context)
        .await?
        .into_iter()
        .find(|payment_method| payment_method.fields.key == method_key)
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No payment method with the key {method_key}"),
        })
}

/// The step types of a flow, as the method rules read them; none when there is no such flow.
pub async fn find_flow_step_types(
    operation_context: &OperationContext,
    flow_key: &str,
) -> Result<Option<Vec<PaymentStepType>>, OperationError> {
    Ok(load_payment_flows(operation_context)
        .await?
        .into_iter()
        .find(|payment_flow| payment_flow.key == flow_key)
        .map(|payment_flow| {
            payment_flow
                .steps
                .iter()
                .filter_map(|flow_step| PaymentStepType::parse(&flow_step.step_type))
                .collect()
        }))
}

/// A method with whether it differs from its shipped version, the gateways offering it and how
/// many payments used it (payments come with W3, so none yet).
pub fn present_payment_method(
    payment_method: PaymentMethodRecord,
    gateway_method_keys: &[(String, Vec<String>)],
) -> PaymentMethodDefinition {
    let method_key = payment_method.fields.key.clone();
    let is_modified = payment_method.is_builtin
        && find_shipped_method(&method_key)
            .is_some_and(|shipped_method| shipped_method.fields != payment_method.fields);
    PaymentMethodDefinition {
        gateway_keys: gateway_method_keys
            .iter()
            .filter(|(_, method_keys)| method_keys.contains(&method_key))
            .map(|(gateway_key, _)| gateway_key.clone())
            .collect(),
        payment_count: 0,
        is_modified,
        is_builtin: payment_method.is_builtin,
        fields: payment_method.fields,
    }
}

pub async fn save_payment_method(
    operation_context: &OperationContext,
    payment_method: &PaymentMethodRecord,
) -> Result<(), OperationError> {
    save_definition(operation_context, METHOD_DEFINITION_KIND, payment_method).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_shipped_methods_parse() {
        let method_keys: Vec<String> = builtin_payment_methods()
            .into_iter()
            .map(|payment_method| payment_method.fields.key)
            .collect();
        assert_eq!(method_keys.len(), 8);
        assert_eq!(method_keys[0], "card");
    }
}
