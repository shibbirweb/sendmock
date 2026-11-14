use super::adapters::seed_section_adapters;
use crate::{OperationContext, OperationError};

const EXPORT_HEADER: &str = "# SendMock seed file, exported from SendMock.\n# Secrets are ${ENV_VAR} references: set them in the environment.\n";

/// The configuration as `sendmock.seed.toml`, section by section in apply order; secrets are
/// `${ENV_VAR}` references, never their values, and empty sections are left out.
pub async fn write_seed_toml(
    operation_context: &OperationContext,
) -> Result<String, OperationError> {
    let mut section_texts = vec![EXPORT_HEADER.to_owned()];
    for section_adapter in seed_section_adapters() {
        let section_tables: Vec<toml::Table> = section_adapter
            .export_items(operation_context)
            .await?
            .into_iter()
            .map(|seed_item| seed_item.table)
            .filter(|section_table| !section_table.is_empty())
            .collect();
        if section_tables.is_empty() {
            continue;
        }
        let section_text =
            super::seed_document::write_section_toml(section_adapter.section(), section_tables)
                .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
        section_texts.push(section_text);
    }
    Ok(section_texts.join("\n"))
}
