use std::collections::BTreeMap;

use sendmock_store::SeedStateRecord;
use serde::{Deserialize, Serialize};

use super::SeedValidation;
use super::adapters::seed_section_adapters;
use super::seed_document::{list_unsupported_sections, read_section_items};
use super::seed_preparation::prepare_seed_for_apply;
use super::seed_section_adapter::SeedSectionAdapter;
use super::seed_sections::format_section_header;
use super::seed_validator::{SetupCheck, check_setup_text};
use crate::setup::{
    SecretReferenceWriter, SetupFileFormat, SetupImportMode, blank_encrypted_secrets,
    prepare_setup_document, read_setup_document, write_setup_document,
};
use crate::{AppSettings, OperationContext, OperationError};

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

/// How a setup is imported: where it came from, for the seed status, the passphrase that
/// opens its encrypted secrets, and whether it merges or replaces.
#[derive(Clone, Default)]
pub struct SetupImportOptions {
    pub source_path: Option<String>,
    pub passphrase: Option<String>,
    pub import_mode: SetupImportMode,
}

/// Checks a TOML seed file, applies it and keeps it as the seed state (see `apply_setup_text`).
pub async fn apply_seed_toml(
    operation_context: &OperationContext,
    seed_toml: &str,
    source_path: Option<String>,
) -> Result<SeedValidation, OperationError> {
    apply_setup_text(
        operation_context,
        seed_toml,
        SetupFileFormat::Toml,
        SetupImportOptions {
            source_path,
            ..SetupImportOptions::default()
        },
    )
    .await
}

/// Checks the file, applies every section it holds through the API's own checks, and keeps it
/// as the seed state (in TOML, whatever format it came in), so reset restores it and seed
/// status compares against it. A file of a format version this build cannot read, an invalid
/// one, or one whose encrypted secrets the passphrase does not open, changes nothing; an item
/// the API refuses stops the apply with its section and number. The seed state keeps the
/// encrypted secrets emptied, never in plain text.
pub async fn apply_setup_text(
    operation_context: &OperationContext,
    setup_text: &str,
    setup_format: SetupFileFormat,
    import_options: SetupImportOptions,
) -> Result<SeedValidation, OperationError> {
    let parsed_document = read_setup_document(setup_text, setup_format).ok();
    if let Some(setup_document) = &parsed_document {
        prepare_setup_document(operation_context, setup_document.clone())?;
    }
    let setup_check = check_setup_text(setup_text, setup_format);
    if !setup_check.is_valid() {
        return Err(describe_invalid_setup(&setup_check));
    }
    let seed_toml = match (setup_format, parsed_document) {
        (SetupFileFormat::Toml, _) => setup_text.to_owned(),
        (_, Some(setup_document)) => write_setup_document(&setup_document, SetupFileFormat::Toml)?,
        (_, None) => return Err(describe_invalid_setup(&setup_check)),
    };
    apply_seed_document(
        operation_context,
        &seed_toml,
        import_options.passphrase.as_deref(),
        import_options.import_mode,
    )
    .await?;
    save_seed_state(
        operation_context,
        blank_encrypted_secrets(&seed_toml),
        import_options.source_path,
    )
    .await?;
    Ok(setup_check.into_seed_validation())
}

/// Applies the seed applied last again and deletes the configuration it does not hold, as
/// reset restores exactly the seed state; answers false, changing nothing, when no seed was
/// ever applied.
pub async fn restore_seed_state(
    operation_context: &OperationContext,
) -> Result<bool, OperationError> {
    let Some(seed_state) = operation_context
        .setup_stores
        .seed_state
        .find_state()
        .await?
    else {
        return Ok(false);
    };
    apply_seed_document(
        operation_context,
        &seed_state.seed_toml,
        None,
        SetupImportMode::Replace,
    )
    .await?;
    save_seed_state(
        operation_context,
        seed_state.seed_toml,
        seed_state.source_path,
    )
    .await?;
    Ok(true)
}

/// Removes every configured item and puts the settings and providers back to what SendMock
/// ships with, as replacing with an empty setup does, and forgets the seed applied last.
pub async fn remove_all_configuration(
    operation_context: &OperationContext,
) -> Result<(), OperationError> {
    apply_seed_document(operation_context, "", None, SetupImportMode::Replace).await?;
    operation_context
        .setup_stores
        .seed_state
        .delete_state()
        .await?;
    Ok(())
}

/// The configuration as seed items, section by section in apply order.
pub async fn export_seed_items(
    operation_context: &OperationContext,
) -> Result<Vec<AppliedSeedItem>, OperationError> {
    let mut exported_items = Vec::new();
    for section_adapter in seed_section_adapters() {
        let seed_section = section_adapter.section();
        for seed_item in section_adapter
            .export_items(operation_context, &SecretReferenceWriter)
            .await?
        {
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

fn describe_invalid_setup(setup_check: &SetupCheck) -> OperationError {
    OperationError::Unprocessable {
        code: "invalid_seed",
        message: format!(
            "The seed file is not valid: {}",
            setup_check.describe_problems()
        ),
    }
}

/// Applies every section in order. Replace first puts the settings back to their defaults and
/// afterwards removes the items the file does not hold, as reset does.
pub(crate) async fn apply_seed_document(
    operation_context: &OperationContext,
    seed_toml: &str,
    passphrase: Option<&str>,
    import_mode: SetupImportMode,
) -> Result<AppliedKeys, OperationError> {
    let prepared_seed = prepare_seed_for_apply(operation_context, seed_toml, passphrase)?;
    let section_adapters = seed_section_adapters();
    warn_about_unsupported_sections(&prepared_seed.seed_document, &section_adapters);
    if import_mode == SetupImportMode::Replace {
        operation_context
            .settings_store
            .save(
                AppSettings::default(),
                operation_context.clock.now_unix_ms(),
            )
            .await?;
    }
    let mut applied_keys = AppliedKeys::new();
    for section_adapter in &section_adapters {
        let item_keys = apply_section(
            operation_context,
            section_adapter.as_ref(),
            &prepared_seed.seed_document,
            &prepared_seed.missing_variables,
        )
        .await?;
        applied_keys.insert(section_adapter.section().section_path, item_keys);
    }
    if import_mode == SetupImportMode::Replace {
        for section_adapter in &section_adapters {
            let section_path = section_adapter.section().section_path;
            let kept_item_keys = applied_keys.get(section_path).cloned().unwrap_or_default();
            section_adapter
                .remove_items_except(operation_context, &kept_item_keys)
                .await?;
        }
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
        .setup_stores
        .seed_state
        .save_state(SeedStateRecord {
            seed_toml,
            source_path,
            applied_at_unix_ms: operation_context.clock.now_unix_ms(),
            applied_items_json,
        })
        .await?;
    Ok(())
}
