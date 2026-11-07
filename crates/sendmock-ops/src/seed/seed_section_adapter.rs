use std::future::Future;
use std::pin::Pin;

use serde::Serialize;
use serde::de::DeserializeOwned;

use super::seed_sections::SeedSection;
use crate::{OperationContext, OperationError};

/// What every seed adapter step answers.
pub type SeedFuture<'step, T> =
    Pin<Box<dyn Future<Output = Result<T, OperationError>> + Send + 'step>>;

/// `created_by` of items a seed file made or last set.
pub const CREATED_BY_SEED: &str = "seed";

/// One item as a seed file holds it, with what identifies it across applies.
#[derive(Debug, Clone, PartialEq)]
pub struct SeedItem {
    /// Matches the item on the next apply: a SID, a number, a name or a pattern.
    pub item_key: String,
    /// How the seed status names it.
    pub item_name: String,
    pub table: toml::Table,
}

/// Reads and writes one section of the seed file (Strategy, looked up in the seed adapter
/// registry): exports the stored items, applies one item through the same checks the API
/// uses, and removes the items a reset should not keep.
pub trait SeedSectionAdapter: Send + Sync {
    fn section(&self) -> &'static SeedSection;

    fn export_items<'step>(
        &'step self,
        operation_context: &'step OperationContext,
    ) -> SeedFuture<'step, Vec<SeedItem>>;

    /// Creates the item, or updates the one with the same key; answers that key.
    fn apply_item<'step>(
        &'step self,
        operation_context: &'step OperationContext,
        item_table: toml::Table,
    ) -> SeedFuture<'step, String>;

    /// Deletes the items whose keys are not listed, as a reset restores exactly the seed.
    fn remove_items_except<'step>(
        &'step self,
        operation_context: &'step OperationContext,
        kept_item_keys: &'step [String],
    ) -> SeedFuture<'step, ()>;
}

/// Reads a seed table into the section's item type, with the field named on failure.
pub fn read_seed_table<SeedFields: DeserializeOwned>(
    item_table: toml::Table,
) -> Result<SeedFields, OperationError> {
    toml::Value::Table(item_table)
        .try_into()
        .map_err(|read_error: toml::de::Error| OperationError::InvalidInput {
            message: read_error.message().to_owned(),
            field: None,
        })
}

/// Writes the section's item type as a seed table; `None` fields are left out.
pub fn write_seed_table<SeedFields: Serialize>(
    seed_fields: &SeedFields,
) -> Result<toml::Table, OperationError> {
    toml::Table::try_from(seed_fields)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

/// Turns the seed's fields into an API input, so the API's own checks and messages apply.
pub fn to_api_input<ApiInput: DeserializeOwned>(
    api_fields: serde_json::Value,
) -> Result<ApiInput, OperationError> {
    serde_json::from_value(api_fields).map_err(|read_error| OperationError::InvalidInput {
        message: read_error.to_string(),
        field: None,
    })
}

/// The `${NAME_SECRET}` reference an export writes in place of a secret, from the item's name:
/// "Laravel inbound mail" gives `${LARAVEL_INBOUND_MAIL_SECRET}`.
pub fn to_secret_reference(item_name: &str) -> String {
    let variable_words: Vec<String> = item_name
        .to_ascii_uppercase()
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_owned)
        .collect();
    format!("${{{}_SECRET}}", variable_words.join("_"))
}

/// Settings that differ from `default_fields`, as TOML values; `skipped_names` are left out.
pub fn write_changed_fields(
    current_fields: serde_json::Value,
    default_fields: &serde_json::Value,
    skipped_names: &[&str],
) -> Result<toml::Table, OperationError> {
    let mut changed_table = toml::Table::new();
    let serde_json::Value::Object(current_fields) = current_fields else {
        return Ok(changed_table);
    };
    for (field_name, field_value) in current_fields {
        let is_default = default_fields.get(&field_name) == Some(&field_value);
        if is_default || field_value.is_null() || skipped_names.contains(&field_name.as_str()) {
            continue;
        }
        let toml_value = toml::Value::try_from(field_value)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
        changed_table.insert(field_name, toml_value);
    }
    Ok(changed_table)
}

/// Implements `SeedSectionAdapter` for an adapter whose inherent async functions `export`,
/// `apply` and `remove_unlisted` do the work, so each adapter file holds only its section.
macro_rules! impl_seed_section_adapter {
    ($adapter:ty, $section:expr) => {
        impl $crate::seed::seed_section_adapter::SeedSectionAdapter for $adapter {
            fn section(&self) -> &'static $crate::seed::seed_sections::SeedSection {
                &$section
            }

            fn export_items<'step>(
                &'step self,
                operation_context: &'step $crate::OperationContext,
            ) -> $crate::seed::seed_section_adapter::SeedFuture<
                'step,
                Vec<$crate::seed::seed_section_adapter::SeedItem>,
            > {
                Box::pin(Self::export(operation_context))
            }

            fn apply_item<'step>(
                &'step self,
                operation_context: &'step $crate::OperationContext,
                item_table: toml::Table,
            ) -> $crate::seed::seed_section_adapter::SeedFuture<'step, String> {
                Box::pin(Self::apply(operation_context, item_table))
            }

            fn remove_items_except<'step>(
                &'step self,
                operation_context: &'step $crate::OperationContext,
                kept_item_keys: &'step [String],
            ) -> $crate::seed::seed_section_adapter::SeedFuture<'step, ()> {
                Box::pin(Self::remove_unlisted(operation_context, kept_item_keys))
            }
        }
    };
}

pub(crate) use impl_seed_section_adapter;

#[cfg(test)]
mod reference_tests {
    use super::to_secret_reference;

    #[test]
    fn names_the_reference_after_the_item() {
        assert_eq!(
            to_secret_reference("Laravel inbound mail"),
            "${LARAVEL_INBOUND_MAIL_SECRET}"
        );
        assert_eq!(
            to_secret_reference("twilio auth-token"),
            "${TWILIO_AUTH_TOKEN_SECRET}"
        );
    }
}
