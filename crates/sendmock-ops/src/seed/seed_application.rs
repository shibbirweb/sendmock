use std::collections::BTreeMap;

use sendmock_store::SeedStateRecord;
use serde::{Deserialize, Serialize};

use super::adapters::seed_section_adapters;
use super::environment_references::resolve_environment_references;
use super::seed_document::{list_unsupported_sections, read_section_items};
use super::seed_section_adapter::SeedSectionAdapter;
use super::seed_sections::format_section_header;
use super::{SeedValidation, validate_seed_toml};
use crate::{OperationContext, OperationError};

/// One item of the configuration as the seed state keeps it, to tell what changed since.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AppliedSeedItem {
    pub section_path: String,
    pub item_kind: String,
    pub item_key: String,
    pub item_name: String,
    pub table: toml::Table,
}

/// The item keys each section's apply touched, by section path.
type AppliedKeys = BTreeMap<&'static str, Vec<String>>;

/// Checks the file, applies every section it holds through the API's own checks, and keeps it
/// as the seed state, so reset restores it and seed status compares against it. An invalid
/// file changes nothing; an item the API refuses stops the apply with its section and number.
pub async fn apply_seed_toml(
    operation_context: &OperationContext,
    seed_toml: &str,
    source_path: Option<String>,
) -> Result<SeedValidation, OperationError> {
    let seed_validation = validate_seed_toml(seed_toml);
    if !seed_validation.is_valid {
        return Err(describe_invalid_seed(&seed_validation));
    }
    apply_seed_document(operation_context, seed_toml).await?;
    save_seed_state(operation_context, seed_toml.to_owned(), source_path).await?;
    Ok(seed_validation)
}

/// Applies the seed applied last again and deletes the configuration it does not hold, as
/// reset restores exactly the seed state; nothing happens when no seed was ever applied.
pub async fn restore_seed_state(
    operation_context: &OperationContext,
) -> Result<(), OperationError> {
    let Some(seed_state) = operation_context.seed_state_repository.find_state().await? else {
        return Ok(());
    };
    let applied_keys = apply_seed_document(operation_context, &seed_state.seed_toml).await?;
    for section_adapter in seed_section_adapters() {
        let section_path = section_adapter.section().section_path;
        let kept_item_keys = applied_keys.get(section_path).cloned().unwrap_or_default();
        section_adapter
            .remove_items_except(operation_context, &kept_item_keys)
            .await?;
    }
    save_seed_state(
        operation_context,
        seed_state.seed_toml,
        seed_state.source_path,
    )
    .await
}

/// The configuration as seed items, section by section in apply order.
pub async fn export_seed_items(
    operation_context: &OperationContext,
) -> Result<Vec<AppliedSeedItem>, OperationError> {
    let mut exported_items = Vec::new();
    for section_adapter in seed_section_adapters() {
        let seed_section = section_adapter.section();
        for seed_item in section_adapter.export_items(operation_context).await? {
            exported_items.push(AppliedSeedItem {
                section_path: seed_section.section_path.to_owned(),
                item_kind: seed_section.item_kind.to_owned(),
                item_key: seed_item.item_key,
                item_name: seed_item.item_name,
                table: seed_item.table,
            });
        }
    }
    Ok(exported_items)
}

fn describe_invalid_seed(seed_validation: &SeedValidation) -> OperationError {
    let problems = seed_validation
        .errors
        .iter()
        .map(|seed_error| format!("line {}: {}", seed_error.line, seed_error.message))
        .collect::<Vec<_>>()
        .join("; ");
    OperationError::Unprocessable {
        code: "invalid_seed",
        message: format!("The seed file is not valid: {problems}"),
    }
}

async fn apply_seed_document(
    operation_context: &OperationContext,
    seed_toml: &str,
) -> Result<AppliedKeys, OperationError> {
    let mut seed_value: toml::Value =
        toml::from_str(seed_toml).map_err(|parse_error| OperationError::Unprocessable {
            code: "invalid_seed",
            message: parse_error.message().to_owned(),
        })?;
    let mut missing_variables = Vec::new();
    resolve_environment_references(
        &mut seed_value,
        operation_context.environment_reader.as_ref(),
        &mut missing_variables,
    );
    if !missing_variables.is_empty() {
        tracing::warn!(
            ?missing_variables,
            "seed file references unset environment variables"
        );
    }
    let toml::Value::Table(seed_document) = seed_value else {
        return Ok(AppliedKeys::new());
    };
    let section_adapters = seed_section_adapters();
    warn_about_unsupported_sections(&seed_document, &section_adapters);
    let mut applied_keys = AppliedKeys::new();
    for section_adapter in &section_adapters {
        let seed_section = section_adapter.section();
        let item_keys = apply_section(
            operation_context,
            section_adapter.as_ref(),
            &seed_document,
            &missing_variables,
        )
        .await?;
        applied_keys.insert(seed_section.section_path, item_keys);
    }
    Ok(applied_keys)
}

async fn apply_section(
    operation_context: &OperationContext,
    section_adapter: &dyn SeedSectionAdapter,
    seed_document: &toml::Table,
    missing_variables: &[String],
) -> Result<Vec<String>, OperationError> {
    let seed_section = section_adapter.section();
    let mut item_keys = Vec::new();
    for (item_index, item_table) in read_section_items(seed_document, seed_section)
        .into_iter()
        .enumerate()
    {
        let item_key = section_adapter
            .apply_item(operation_context, item_table)
            .await
            .map_err(|apply_error| {
                let section_header =
                    format_section_header(seed_section.section_path, seed_section.is_item_list);
                OperationError::Unprocessable {
                    code: "invalid_seed",
                    message: format!(
                        "{section_header} item {}: {apply_error}{}",
                        item_index + 1,
                        describe_missing_variables(missing_variables)
                    ),
                }
            })?;
        item_keys.push(item_key);
    }
    Ok(item_keys)
}

/// Names the unset environment variables, as an empty value is often why an item is refused.
fn describe_missing_variables(missing_variables: &[String]) -> String {
    if missing_variables.is_empty() {
        return String::new();
    }
    format!(
        " (not set in the environment: {})",
        missing_variables.join(", ")
    )
}

fn warn_about_unsupported_sections(
    seed_document: &toml::Table,
    section_adapters: &[Box<dyn SeedSectionAdapter>],
) {
    let supported_sections: Vec<_> = section_adapters
        .iter()
        .map(|section_adapter| section_adapter.section())
        .collect();
    let unsupported_sections = list_unsupported_sections(seed_document, &supported_sections);
    if !unsupported_sections.is_empty() {
        tracing::warn!(
            ?unsupported_sections,
            "this build cannot apply these seed sections yet, so they were skipped"
        );
    }
}

async fn save_seed_state(
    operation_context: &OperationContext,
    seed_toml: String,
    source_path: Option<String>,
) -> Result<(), OperationError> {
    let applied_items = export_seed_items(operation_context).await?;
    let applied_items_json = serde_json::to_string(&applied_items)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    operation_context
        .seed_state_repository
        .save_state(SeedStateRecord {
            seed_toml,
            source_path,
            applied_at_unix_ms: operation_context.clock.now_unix_ms(),
            applied_items_json,
        })
        .await?;
    Ok(())
}
