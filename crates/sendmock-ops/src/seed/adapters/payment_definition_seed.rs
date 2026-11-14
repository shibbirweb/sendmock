use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::OperationError;
use crate::seed::seed_section_adapter::{SeedItem, read_seed_table, write_seed_table};

/// A `[[payments.flows]]`, `[[payments.methods]]` or `[[payments.gateways]]` item, matched by
/// `key`: a custom definition, or a built-in's edits, with the definition as JSON as the API
/// takes it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SeedPaymentDefinition {
    pub key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default)]
    pub edits_builtin: bool,
    /// The gateway's notification endpoint by name, as endpoint ids differ between instances.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notification_endpoint: Option<String>,
    pub definition: String,
}

impl SeedPaymentDefinition {
    pub fn read(item_table: toml::Table) -> Result<Self, OperationError> {
        let mut seed_definition: Self = read_seed_table(item_table)?;
        seed_definition.key = seed_definition.key.trim().to_owned();
        Ok(seed_definition)
    }

    /// The definition's fields with the item's key, as the API's create and update take them.
    pub fn read_fields(&self, key_field: &str) -> Result<Value, OperationError> {
        let mut definition_fields: Value =
            serde_json::from_str(&self.definition).map_err(|read_error| {
                OperationError::InvalidInput {
                    message: format!("definition is not valid JSON: {read_error}"),
                    field: Some("definition".to_owned()),
                }
            })?;
        if !definition_fields.is_object() {
            return Err(OperationError::InvalidInput {
                message: "definition must be a JSON object".to_owned(),
                field: Some("definition".to_owned()),
            });
        }
        definition_fields["key"] = Value::from(self.key.as_str());
        definition_fields[key_field] = Value::from(self.key.as_str());
        Ok(definition_fields)
    }
}

/// The stored definition as a seed item; `key` and the counts the API adds are left out.
pub fn write_definition_item(
    mut definition_fields: Value,
    is_builtin: bool,
    notification_endpoint: Option<String>,
) -> Result<SeedItem, OperationError> {
    let key = definition_fields["key"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let name = definition_fields["name"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    if let Some(definition_object) = definition_fields.as_object_mut() {
        for derived_field in [
            "key",
            "is_builtin",
            "is_modified",
            "payment_count",
            "method_count",
            "gateway_keys",
            "notification_endpoint_id",
        ] {
            definition_object.remove(derived_field);
        }
    }
    let definition = serde_json::to_string(&definition_fields)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    Ok(SeedItem {
        item_key: key.clone(),
        item_name: name.clone(),
        table: write_seed_table(&SeedPaymentDefinition {
            key,
            name: Some(name),
            edits_builtin: is_builtin,
            notification_endpoint,
            definition,
        })?,
    })
}

pub fn to_json_value<T: Serialize>(definition: &T) -> Result<Value, OperationError> {
    serde_json::to_value(definition)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

/// A custom definition another one still uses cannot be deleted; a reset leaves it.
pub fn ignore_in_use(delete_result: Result<(), OperationError>) -> Result<(), OperationError> {
    match delete_result {
        Err(OperationError::Conflict { message, .. }) => {
            tracing::warn!(message, "a seeded reset kept a payment definition in use");
            Ok(())
        }
        other_result => other_result,
    }
}
