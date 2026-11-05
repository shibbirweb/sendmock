use sendmock_store::PaymentDefinitionRecord;

use super::payment_flow_views::{
    PaymentFlowDefinition, PaymentFlowRecord, PaymentFlowVariable, PaymentStepTypeInfo,
};
use super::payment_method_catalogue::load_payment_methods;
use crate::{OperationContext, OperationError};

/// Exported from the mock by `web/scripts/export-builtin-definitions.ts`, so the UI and the
/// binary ship the same flows, methods, step catalogue and label variables.
const BUILTIN_FLOWS_JSON: &str = include_str!("../../builtin/payment-flows.json");
const STEP_TYPES_JSON: &str = include_str!("../../builtin/payment-step-types.json");
const FLOW_VARIABLES_JSON: &str = include_str!("../../builtin/payment-flow-variables.json");

pub const FLOW_DEFINITION_KIND: &str = "flow";

pub fn builtin_payment_flows() -> Vec<PaymentFlowRecord> {
    serde_json::from_str(BUILTIN_FLOWS_JSON).unwrap_or_default()
}

pub fn find_shipped_flow(flow_key: &str) -> Option<PaymentFlowRecord> {
    builtin_payment_flows()
        .into_iter()
        .find(|shipped_flow| shipped_flow.key == flow_key)
}

pub fn payment_step_types() -> Vec<PaymentStepTypeInfo> {
    serde_json::from_str(STEP_TYPES_JSON).unwrap_or_default()
}

pub fn payment_flow_variables() -> Vec<PaymentFlowVariable> {
    serde_json::from_str(FLOW_VARIABLES_JSON).unwrap_or_default()
}

fn read_stored_flow(
    stored_definition: &PaymentDefinitionRecord,
) -> Result<PaymentFlowRecord, OperationError> {
    serde_json::from_str(&stored_definition.definition_json)
        .map_err(|read_error| OperationError::Internal(read_error.to_string()))
}

/// Every flow as checkouts see it: the built-ins with their stored edits, then custom flows in
/// the order they were added.
pub async fn load_payment_flows(
    operation_context: &OperationContext,
) -> Result<Vec<PaymentFlowRecord>, OperationError> {
    let stored_flows = operation_context
        .payment_definition_repository
        .list_definitions(FLOW_DEFINITION_KIND)
        .await?
        .iter()
        .map(read_stored_flow)
        .collect::<Result<Vec<_>, _>>()?;
    let mut payment_flows: Vec<PaymentFlowRecord> = builtin_payment_flows()
        .into_iter()
        .map(|shipped_flow| {
            stored_flows
                .iter()
                .find(|stored_flow| stored_flow.key == shipped_flow.key)
                .cloned()
                .unwrap_or(shipped_flow)
        })
        .collect();
    payment_flows.extend(
        stored_flows
            .into_iter()
            .filter(|stored_flow| !stored_flow.is_builtin),
    );
    Ok(payment_flows)
}

pub async fn find_payment_flow(
    operation_context: &OperationContext,
    flow_key: &str,
) -> Result<PaymentFlowRecord, OperationError> {
    load_payment_flows(operation_context)
        .await?
        .into_iter()
        .find(|payment_flow| payment_flow.key == flow_key)
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No payment flow with the key {flow_key}"),
        })
}

/// The flow each payment method uses, built-ins with their edits and custom ones.
pub async fn load_method_flow_keys(
    operation_context: &OperationContext,
) -> Result<Vec<(String, String)>, OperationError> {
    Ok(load_payment_methods(operation_context)
        .await?
        .into_iter()
        .map(|payment_method| (payment_method.fields.key, payment_method.fields.flow))
        .collect())
}

/// A flow with whether it differs from its shipped version and how many methods use it.
pub async fn present_payment_flow(
    operation_context: &OperationContext,
    payment_flow: PaymentFlowRecord,
) -> Result<PaymentFlowDefinition, OperationError> {
    let method_flow_keys = load_method_flow_keys(operation_context).await?;
    Ok(present_with_usage(payment_flow, &method_flow_keys))
}

pub fn present_with_usage(
    payment_flow: PaymentFlowRecord,
    method_flow_keys: &[(String, String)],
) -> PaymentFlowDefinition {
    let is_modified = payment_flow.is_builtin
        && find_shipped_flow(&payment_flow.key).is_some_and(|shipped_flow| {
            (
                &shipped_flow.name,
                &shipped_flow.picker_tab,
                &shipped_flow.steps,
            ) != (
                &payment_flow.name,
                &payment_flow.picker_tab,
                &payment_flow.steps,
            )
        });
    let method_count = method_flow_keys
        .iter()
        .filter(|(_, flow_key)| *flow_key == payment_flow.key)
        .count();
    PaymentFlowDefinition {
        method_count: u32::try_from(method_count).unwrap_or(u32::MAX),
        is_modified,
        key: payment_flow.key,
        name: payment_flow.name,
        picker_tab: payment_flow.picker_tab,
        steps: payment_flow.steps,
        is_builtin: payment_flow.is_builtin,
    }
}

/// Stores the flow; for a built-in, the stored row is its edit.
pub async fn save_payment_flow(
    operation_context: &OperationContext,
    payment_flow: &PaymentFlowRecord,
) -> Result<(), OperationError> {
    let definition_json = serde_json::to_string(payment_flow)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    operation_context
        .payment_definition_repository
        .save_definition(PaymentDefinitionRecord {
            kind: FLOW_DEFINITION_KIND.to_owned(),
            definition_key: payment_flow.key.clone(),
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
    fn the_shipped_flows_step_types_and_variables_parse() {
        let flow_keys: Vec<String> = builtin_payment_flows()
            .into_iter()
            .map(|flow| flow.key)
            .collect();
        assert_eq!(
            flow_keys,
            [
                "card",
                "wallet",
                "bank",
                "account",
                "qr",
                "bank_transfer",
                "voucher"
            ]
        );
        let step_types = payment_step_types();
        assert_eq!(
            step_types.len(),
            sendmock_payments::PaymentStepType::ALL.len()
        );
        for step_type_info in &step_types {
            let step_type = sendmock_payments::PaymentStepType::parse(&step_type_info.step_type);
            assert_eq!(
                step_type.map(|step_type| step_type.is_deciding()),
                Some(step_type_info.is_deciding)
            );
            assert_eq!(
                step_type.map(|step_type| step_type.has_field()),
                Some(step_type_info.has_field)
            );
        }
        let variable_tokens: Vec<String> = payment_flow_variables()
            .into_iter()
            .map(|variable| variable.token)
            .collect();
        let expected_tokens: Vec<String> = sendmock_payments::FLOW_LABEL_VARIABLE_NAMES
            .iter()
            .map(|variable_name| format!("{{{variable_name}}}"))
            .collect();
        assert_eq!(variable_tokens, expected_tokens);
    }
}
