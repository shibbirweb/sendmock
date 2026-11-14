use serde_json::json;

use super::payment_definition_seed::{
    SeedPaymentDefinition, ignore_in_use, to_json_value, write_definition_item,
};
use crate::payments::{
    CreatePaymentMethodOperation, DeletePaymentMethodOperation, GetPaymentMethodOperation,
    ListPaymentMethodsOperation, ResetPaymentMethodOperation, UpdatePaymentMethodOperation,
};
use crate::seed::seed_section_adapter::{SeedItem, impl_seed_section_adapter, to_api_input};
use crate::seed::seed_sections::PAYMENT_METHODS_SECTION;
use crate::{NoInput, Operation, OperationContext, OperationError};

/// `[[payments.methods]]`, matched by `key`: a custom method, or a built-in's edits (its test
/// values, OTP, PIN and outcome).
pub struct PaymentMethodSeedAdapter;

impl PaymentMethodSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_method = SeedPaymentDefinition::read(item_table)?;
        let method_fields = seed_method.read_fields("method_key")?;
        let method_reference = json!({ "method_key": seed_method.key });
        match GetPaymentMethodOperation
            .execute(operation_context, to_api_input(method_reference)?)
            .await
        {
            Ok(_) => {
                UpdatePaymentMethodOperation
                    .execute(operation_context, to_api_input(method_fields)?)
                    .await?;
            }
            Err(OperationError::NotFound { .. }) => {
                CreatePaymentMethodOperation
                    .execute(operation_context, to_api_input(method_fields)?)
                    .await?;
            }
            Err(other_error) => return Err(other_error),
        }
        Ok(seed_method.key)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let payment_methods = ListPaymentMethodsOperation
            .execute(operation_context, NoInput {})
            .await?;
        payment_methods
            .into_iter()
            .filter(|payment_method| !payment_method.is_builtin || payment_method.is_modified)
            .map(|payment_method| {
                write_definition_item(
                    to_json_value(&payment_method)?,
                    payment_method.is_builtin,
                    None,
                )
            })
            .collect()
    }

    /// Resets edited built-ins and deletes custom methods the seed does not hold.
    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let payment_methods = ListPaymentMethodsOperation
            .execute(operation_context, NoInput {})
            .await?;
        for payment_method in payment_methods {
            let method_key = payment_method.fields.key.clone();
            if kept_item_keys.contains(&method_key) {
                continue;
            }
            let method_reference = to_api_input(json!({ "method_key": method_key }))?;
            if !payment_method.is_builtin {
                let delete_result = DeletePaymentMethodOperation
                    .execute(operation_context, method_reference)
                    .await
                    .map(|_| ());
                ignore_in_use(delete_result)?;
            } else if payment_method.is_modified {
                ResetPaymentMethodOperation
                    .execute(operation_context, method_reference)
                    .await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(PaymentMethodSeedAdapter, PAYMENT_METHODS_SECTION);
