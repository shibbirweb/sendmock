use std::future::Future;
use std::pin::Pin;

use schemars::{Schema, SchemaGenerator};
use serde::Serialize;
use serde::de::DeserializeOwned;

use super::seed_sections::SeedSection;
use crate::setup::SetupSecretWriter;
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

    /// Writes each secret through `secret_writer`: a reference, or encrypted for a move.
    fn export_items<'step>(
        &'step self,
        operation_context: &'step OperationContext,
        secret_writer: &'step dyn SetupSecretWriter,
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

    /// The JSON Schema of one item, for the setup file's published schema.
    fn describe_item_schema(&self, schema_generator: &mut SchemaGenerator) -> Schema;

    /// The item as an export would write it, with the defaults a file may leave out filled
    /// in, so an import preview compares like with like.
    fn normalize_item(&self, item_table: &toml::Table) -> toml::Table;

    /// Reads the item into the section's type, as the apply does first, so validate refuses an
    /// unknown key or a wrong type exactly where import would, without writing anything.
    fn check_item(&self, item_table: &toml::Table) -> Result<(), OperationError>;
}

/// The check of a section whose items have a type: reading the item into it.
pub fn check_seed_table<SeedFields: DeserializeOwned>(
    item_table: &toml::Table,
) -> Result<(), OperationError> {
    read_seed_table::<SeedFields>(item_table.clone()).map(|_| ())
}

/// The check of a section read without a type, whose apply names its own problems.
pub fn accept_untyped_item(_item_table: &toml::Table) -> Result<(), OperationError> {
    Ok(())
}

/// Reads a file item into the section's type and writes it back; an item the type cannot
/// read stays as written, and the apply names its problem.
pub fn normalize_seed_table<SeedFields: Serialize + DeserializeOwned>(
    item_table: &toml::Table,
) -> toml::Table {
    read_seed_table::<SeedFields>(item_table.clone())
        .and_then(|seed_fields| write_seed_table(&seed_fields))
        .unwrap_or_else(|_| item_table.clone())
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
/// `apply` and `remove_unlisted` do the work, so each adapter file holds only its section. The
/// third argument is the item's type, whose JSON Schema the setup schema uses, or
/// `schema = <function>` for a section read without one (its items are compared as written).
/// A section that holds secrets adds `writes_secrets`, and its `export` also takes the
/// `SetupSecretWriter`; one whose file items hold only what they change, such as the
/// settings, adds `compared_as_written`.
macro_rules! impl_seed_section_adapter {
    ($adapter:ty, $section:expr, schema = $describe_item_schema:path) => {
        $crate::seed::seed_section_adapter::impl_seed_section_adapter!(
            @adapter $adapter,
            $section,
            $describe_item_schema,
            |item_table: &toml::Table| item_table.clone(),
            $crate::seed::seed_section_adapter::accept_untyped_item,
            |operation_context, _secret_writer| Self::export(operation_context)
        );
    };
    ($adapter:ty, $section:expr, $item_type:ty, writes_secrets) => {
        $crate::seed::seed_section_adapter::impl_seed_section_adapter!(
            @adapter $adapter,
            $section,
            |schema_generator: &mut ::schemars::SchemaGenerator| {
                schema_generator.subschema_for::<$item_type>()
            },
            $crate::seed::seed_section_adapter::normalize_seed_table::<$item_type>,
            $crate::seed::seed_section_adapter::check_seed_table::<$item_type>,
            |operation_context, secret_writer| Self::export(operation_context, secret_writer)
        );
    };
    ($adapter:ty, $section:expr, $item_type:ty, compared_as_written) => {
        $crate::seed::seed_section_adapter::impl_seed_section_adapter!(
            @adapter $adapter,
            $section,
            |schema_generator: &mut ::schemars::SchemaGenerator| {
                schema_generator.subschema_for::<$item_type>()
            },
            |item_table: &toml::Table| item_table.clone(),
            $crate::seed::seed_section_adapter::check_seed_table::<$item_type>,
            |operation_context, _secret_writer| Self::export(operation_context)
        );
    };
    ($adapter:ty, $section:expr, $item_type:ty) => {
        $crate::seed::seed_section_adapter::impl_seed_section_adapter!(
            @adapter $adapter,
            $section,
            |schema_generator: &mut ::schemars::SchemaGenerator| {
                schema_generator.subschema_for::<$item_type>()
            },
            $crate::seed::seed_section_adapter::normalize_seed_table::<$item_type>,
            $crate::seed::seed_section_adapter::check_seed_table::<$item_type>,
            |operation_context, _secret_writer| Self::export(operation_context)
        );
    };
    (
        @adapter $adapter:ty,
        $section:expr,
        $describe_item_schema:expr,
        $normalize_item:expr,
        $check_item:expr,
        |$export_context:ident, $secret_writer:ident| $export_call:expr
    ) => {
        impl $crate::seed::seed_section_adapter::SeedSectionAdapter for $adapter {
            fn section(&self) -> &'static $crate::seed::seed_sections::SeedSection {
                &$section
            }

            fn export_items<'step>(
                &'step self,
                $export_context: &'step $crate::OperationContext,
                $secret_writer: &'step dyn $crate::setup::SetupSecretWriter,
            ) -> $crate::seed::seed_section_adapter::SeedFuture<
                'step,
                Vec<$crate::seed::seed_section_adapter::SeedItem>,
            > {
                Box::pin($export_call)
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

            fn describe_item_schema(
                &self,
                schema_generator: &mut ::schemars::SchemaGenerator,
            ) -> ::schemars::Schema {
                ($describe_item_schema)(schema_generator)
            }

            fn normalize_item(&self, item_table: &toml::Table) -> toml::Table {
                ($normalize_item)(item_table)
            }

            fn check_item(
                &self,
                item_table: &toml::Table,
            ) -> Result<(), $crate::OperationError> {
                ($check_item)(item_table)
            }
        }
    };
}

pub(crate) use impl_seed_section_adapter;
