use serde_json::json;

use super::payment_definition_seed::{
    SeedPaymentDefinition, ignore_in_use, to_json_value, write_definition_item,
};
use crate::payments::{
    CreatePaymentFlowOperation, DeletePaymentFlowOperation, GetPaymentFlowOperation,
    ListPaymentFlowsOperation, ResetPaymentFlowOperation, UpdatePaymentFlowOperation,
};
use crate::seed::seed_section_adapter::{SeedItem, impl_seed_section_adapter, to_api_input};
use crate::seed::seed_sections::PAYMENT_FLOWS_SECTION;
use crate::{NoInput, Operation, OperationContext, OperationError};

/// `[[payments.flows]]`, matched by `key`: a custom flow, or a built-in's edited steps and
/// labels.
pub struct PaymentFlowSeedAdapter;

impl PaymentFlowSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_flow = SeedPaymentDefinition::read(item_table)?;
        let flow_fields = seed_flow.read_fields("flow_key")?;
        let flow_reference = json!({ "flow_key": seed_flow.key });
        match GetPaymentFlowOperation
            .execute(operation_context, to_api_input(flow_reference)?)
            .await
        {
            Ok(_) => {
                UpdatePaymentFlowOperation
                    .execute(operation_context, to_api_input(flow_fields)?)
                    .await?;
            }
            Err(OperationError::NotFound { .. }) => {
                CreatePaymentFlowOperation
                    .execute(operation_context, to_api_input(flow_fields)?)
                    .await?;
            }
            Err(other_error) => return Err(other_error),
        }
        Ok(seed_flow.key)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let payment_flows = ListPaymentFlowsOperation
            .execute(operation_context, NoInput {})
            .await?;
        payment_flows
            .into_iter()
            .filter(|payment_flow| !payment_flow.is_builtin || payment_flow.is_modified)
            .map(|payment_flow| {
                write_definition_item(to_json_value(&payment_flow)?, payment_flow.is_builtin, None)
            })
            .collect()
    }

    /// Resets edited built-ins and deletes custom flows the seed does not hold.
    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let payment_flows = ListPaymentFlowsOperation
            .execute(operation_context, NoInput {})
            .await?;
        for payment_flow in payment_flows {
            if kept_item_keys.contains(&payment_flow.key) {
                continue;
            }
            let flow_reference = to_api_input(json!({ "flow_key": payment_flow.key }))?;
            if !payment_flow.is_builtin {
                let delete_result = DeletePaymentFlowOperation
                    .execute(operation_context, flow_reference)
                    .await
                    .map(|_| ());
                ignore_in_use(delete_result)?;
            } else if payment_flow.is_modified {
                ResetPaymentFlowOperation
                    .execute(operation_context, flow_reference)
                    .await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(PaymentFlowSeedAdapter, PAYMENT_FLOWS_SECTION);
