use sendmock_store::PaymentDefinitionRecord;
use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::{OperationContext, OperationError};

pub const FLOW_DEFINITION_KIND: &str = "flow";
pub const METHOD_DEFINITION_KIND: &str = "method";
pub const GATEWAY_DEFINITION_KIND: &str = "gateway";

/// A flow, method or gateway definition as the catalogue keeps it.
pub trait PaymentDefinition: Clone + Serialize + DeserializeOwned {
    fn definition_key(&self) -> &str;
    fn is_builtin(&self) -> bool;
}

/// The shipped definitions with their stored edits first, then the custom ones in the order
/// they were added.
pub async fn load_definitions<Definition: PaymentDefinition>(
    operation_context: &OperationContext,
    kind: &str,
    shipped_definitions: Vec<Definition>,
) -> Result<Vec<Definition>, OperationError> {
    let stored_definitions: Vec<Definition> = operation_context
        .payment_definition_repository
        .list_definitions(kind)
        .await?
        .iter()
        .map(|stored_definition| {
            serde_json::from_str(&stored_definition.definition_json)
                .map_err(|read_error| OperationError::Internal(read_error.to_string()))
        })
        .collect::<Result<_, _>>()?;
    let mut definitions: Vec<Definition> = shipped_definitions
        .into_iter()
        .map(|shipped_definition| {
            stored_definitions
                .iter()
                .find(|stored| stored.definition_key() == shipped_definition.definition_key())
                .cloned()
                .unwrap_or(shipped_definition)
        })
        .collect();
    definitions.extend(
        stored_definitions
            .into_iter()
            .filter(|stored| !stored.is_builtin()),
    );
    Ok(definitions)
}

/// Stores the definition; for a built-in, the stored row is its edit.
pub async fn save_definition<Definition: PaymentDefinition>(
    operation_context: &OperationContext,
    kind: &str,
    definition: &Definition,
) -> Result<(), OperationError> {
    let definition_json = serde_json::to_string(definition)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    operation_context
        .payment_definition_repository
        .save_definition(PaymentDefinitionRecord {
            kind: kind.to_owned(),
            definition_key: definition.definition_key().to_owned(),
            definition_json,
            updated_at_unix_ms: operation_context.clock.now_unix_ms(),
        })
        .await?;
    Ok(())
}

/// Removes the stored row: a custom definition is gone, a built-in is back as shipped.
pub async fn delete_definition(
    operation_context: &OperationContext,
    kind: &str,
    definition_key: &str,
) -> Result<(), OperationError> {
    operation_context
        .payment_definition_repository
        .delete_definition(kind, definition_key)
        .await?;
    Ok(())
}
