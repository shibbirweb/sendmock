use serde_json::{Value, json};

use super::endpoint_names::EndpointNames;
use super::payment_definition_seed::{
    SeedPaymentDefinition, ignore_in_use, to_json_value, write_definition_item,
};
use crate::payments::{
    CreatePaymentGatewayOperation, DeletePaymentGatewayOperation, GetPaymentGatewayOperation,
    ListPaymentGatewaysOperation, PaymentGatewayDefinition, ResetPaymentGatewayOperation,
    UpdatePaymentGatewayOperation,
};
use crate::seed::seed_section_adapter::{
    SeedItem, impl_seed_section_adapter, to_api_input, to_secret_reference,
};
use crate::seed::seed_sections::PAYMENT_GATEWAYS_SECTION;
use crate::{NoInput, Operation, OperationContext, OperationError};

/// `[[payments.gateways]]`, matched by `key`: a custom gateway, or a built-in's edits, with
/// secret credentials as `${ENV_VAR}` references and the notification endpoint by name.
pub struct PaymentGatewaySeedAdapter;

/// The gateway as a seed item: each secret credential becomes its reference.
fn write_gateway_item(
    payment_gateway: &PaymentGatewayDefinition,
    endpoint_names: &EndpointNames,
) -> Result<SeedItem, OperationError> {
    let mut gateway_fields = to_json_value(payment_gateway)?;
    if let Some(credentials) = gateway_fields["credentials"].as_array_mut() {
        for credential in credentials {
            if credential["is_secret"] == Value::Bool(true) {
                let credential_name = credential["name"].as_str().unwrap_or_default();
                credential["value"] = Value::from(to_secret_reference(&format!(
                    "{}_{credential_name}",
                    payment_gateway.fields.key
                )));
            }
        }
    }
    let notification_endpoint = payment_gateway
        .fields
        .notification_endpoint_id
        .as_deref()
        .and_then(|endpoint_id| endpoint_names.find_name(endpoint_id));
    write_definition_item(
        gateway_fields,
        payment_gateway.is_builtin,
        notification_endpoint,
    )
}

/// A secret left empty (an unset `${ENV_VAR}`) is sent back masked, which keeps the stored one.
fn keep_unset_secrets(gateway_fields: &mut Value, current_gateway: &PaymentGatewayDefinition) {
    let Some(credentials) = gateway_fields["credentials"].as_array_mut() else {
        return;
    };
    for credential in credentials {
        let is_unset_secret = credential["is_secret"] == Value::Bool(true)
            && credential["value"].as_str().is_some_and(str::is_empty);
        let credential_name = credential["name"].as_str().unwrap_or_default().to_owned();
        if let Some(current_credential) =
            current_gateway
                .fields
                .credentials
                .iter()
                .find(|current_credential| {
                    is_unset_secret && current_credential.name == credential_name
                })
        {
            credential["value"] = Value::from(current_credential.value.clone());
        }
    }
}

impl PaymentGatewaySeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_gateway = SeedPaymentDefinition::read(item_table)?;
        let mut gateway_fields = seed_gateway.read_fields("gateway_key")?;
        gateway_fields["notification_endpoint_id"] = match &seed_gateway.notification_endpoint {
            Some(endpoint_name) => Value::from(
                EndpointNames::load(operation_context)
                    .await?
                    .find_id(endpoint_name)?,
            ),
            None => Value::Null,
        };
        let gateway_reference = json!({ "gateway_key": seed_gateway.key });
        let current_gateway = match GetPaymentGatewayOperation
            .execute(operation_context, to_api_input(gateway_reference)?)
            .await
        {
            Ok(current_gateway) => current_gateway,
            Err(OperationError::NotFound { .. }) => {
                let gateway_start = json!({
                    "name": gateway_fields["name"], "key": seed_gateway.key, "start_from": null,
                });
                CreatePaymentGatewayOperation
                    .execute(operation_context, to_api_input(gateway_start)?)
                    .await?
            }
            Err(other_error) => return Err(other_error),
        };
        keep_unset_secrets(&mut gateway_fields, &current_gateway);
        UpdatePaymentGatewayOperation
            .execute(operation_context, to_api_input(gateway_fields)?)
            .await?;
        Ok(seed_gateway.key)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let endpoint_names = EndpointNames::load(operation_context).await?;
        let payment_gateways = ListPaymentGatewaysOperation
            .execute(operation_context, NoInput {})
            .await?;
        payment_gateways
            .iter()
            .filter(|payment_gateway| !payment_gateway.is_builtin || payment_gateway.is_modified)
            .map(|payment_gateway| write_gateway_item(payment_gateway, &endpoint_names))
            .collect()
    }

    /// Resets edited built-ins and deletes custom gateways the seed does not hold.
    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let payment_gateways = ListPaymentGatewaysOperation
            .execute(operation_context, NoInput {})
            .await?;
        for payment_gateway in payment_gateways {
            let gateway_key = payment_gateway.fields.key.clone();
            if kept_item_keys.contains(&gateway_key) {
                continue;
            }
            let gateway_reference = to_api_input(json!({ "gateway_key": gateway_key }))?;
            if !payment_gateway.is_builtin {
                let delete_result = DeletePaymentGatewayOperation
                    .execute(operation_context, gateway_reference)
                    .await
                    .map(|_| ());
                ignore_in_use(delete_result)?;
            } else if payment_gateway.is_modified {
                ResetPaymentGatewayOperation
                    .execute(operation_context, gateway_reference)
                    .await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(PaymentGatewaySeedAdapter, PAYMENT_GATEWAYS_SECTION);
