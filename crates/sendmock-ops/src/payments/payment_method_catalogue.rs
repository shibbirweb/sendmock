use sendmock_payments::PaymentStepType;
use sendmock_store::PaymentDefinitionRecord;
use serde_json::Value;

use super::payment_flow_catalogue::load_payment_flows;
use super::payment_method_views::{PaymentMethodDefinition, PaymentMethodRecord};
use crate::{OperationContext, OperationError};

/// Exported from the mock by `web/scripts/export-builtin-definitions.ts`.
const BUILTIN_METHODS_JSON: &str = include_str!("../../builtin/payment-methods.json");
const BUILTIN_GATEWAYS_JSON: &str = include_str!("../../builtin/payment-gateways.json");

pub const METHOD_DEFINITION_KIND: &str = "method";
pub const GATEWAY_DEFINITION_KIND: &str = "gateway";

pub fn builtin_payment_methods() -> Vec<PaymentMethodRecord> {
    serde_json::from_str(BUILTIN_METHODS_JSON).unwrap_or_default()
}

pub fn find_shipped_method(method_key: &str) -> Option<PaymentMethodRecord> {
    builtin_payment_methods()
        .into_iter()
        .find(|shipped_method| shipped_method.fields.key == method_key)
}

/// Built-ins with their stored edits first, then custom definitions in the order they were
/// added; shared by methods and gateways, which are stored the same way.
fn merge_with_stored<Definition: Clone>(
    shipped_definitions: Vec<Definition>,
    stored_definitions: Vec<Definition>,
    read_key: impl Fn(&Definition) -> &str,
    is_builtin: impl Fn(&Definition) -> bool,
) -> Vec<Definition> {
    let mut merged_definitions: Vec<Definition> = shipped_definitions
        .into_iter()
        .map(|shipped_definition| {
            stored_definitions
                .iter()
                .find(|stored_definition| {
                    read_key(stored_definition) == read_key(&shipped_definition)
                })
                .cloned()
                .unwrap_or(shipped_definition)
        })
        .collect();
    merged_definitions.extend(
        stored_definitions
            .into_iter()
            .filter(|stored| !is_builtin(stored)),
    );
    merged_definitions
}

async fn load_stored<Definition: serde::de::DeserializeOwned>(
    operation_context: &OperationContext,
    kind: &str,
) -> Result<Vec<Definition>, OperationError> {
    operation_context
        .payment_definition_repository
        .list_definitions(kind)
        .await?
        .iter()
        .map(|stored_definition: &PaymentDefinitionRecord| {
            serde_json::from_str(&stored_definition.definition_json)
                .map_err(|read_error| OperationError::Internal(read_error.to_string()))
        })
        .collect()
}

pub async fn load_payment_methods(
    operation_context: &OperationContext,
) -> Result<Vec<PaymentMethodRecord>, OperationError> {
    Ok(merge_with_stored(
        builtin_payment_methods(),
        load_stored(operation_context, METHOD_DEFINITION_KIND).await?,
        |method| method.fields.key.as_str(),
        |method| method.is_builtin,
    ))
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

/// Each gateway's key and the methods it offers, built-ins with their edits and custom ones.
pub async fn load_gateway_method_keys(
    operation_context: &OperationContext,
) -> Result<Vec<(String, Vec<String>)>, OperationError> {
    let builtin_gateways: Vec<Value> =
        serde_json::from_str(BUILTIN_GATEWAYS_JSON).unwrap_or_default();
    let stored_gateways: Vec<Value> =
        load_stored(operation_context, GATEWAY_DEFINITION_KIND).await?;
    let gateways = merge_with_stored(
        builtin_gateways,
        stored_gateways,
        |gateway| gateway["key"].as_str().unwrap_or_default(),
        |gateway| gateway["is_builtin"].as_bool().unwrap_or_default(),
    );
    Ok(gateways
        .iter()
        .map(|gateway| {
            let method_keys = gateway["method_keys"]
                .as_array()
                .map(|method_keys| {
                    method_keys
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_owned)
                        .collect()
                })
                .unwrap_or_default();
            (
                gateway["key"].as_str().unwrap_or_default().to_owned(),
                method_keys,
            )
        })
        .collect())
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
    let definition_json = serde_json::to_string(payment_method)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    operation_context
        .payment_definition_repository
        .save_definition(PaymentDefinitionRecord {
            kind: METHOD_DEFINITION_KIND.to_owned(),
            definition_key: payment_method.fields.key.clone(),
            definition_json,
            updated_at_unix_ms: operation_context.clock.now_unix_ms(),
        })
        .await?;
    Ok(())
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
