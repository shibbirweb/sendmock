use sendmock_core::format_rfc3339;

use super::adapters::seed_section_adapters;
use crate::setup::{CURRENT_FORMAT_VERSION, HEADER_KEY, build_setup_header};
use crate::{OperationContext, OperationError};

const EXPORT_COMMENT: &str =
    "# SendMock setup file.\n# Secrets are ${ENV_VAR} references: set them in the environment.\n";

/// The configuration as a setup file: the `[sendmock]` header naming the format version, this
/// release and the time, then each section in apply order; secrets are `${ENV_VAR}`
/// references, never their values, and empty sections are left out.
pub async fn write_seed_toml(
    operation_context: &OperationContext,
) -> Result<String, OperationError> {
    let exported_at = format_rfc3339(operation_context.clock.now_unix_ms());
    let mut header_document = toml::Table::new();
    header_document.insert(
        HEADER_KEY.to_owned(),
        build_setup_header(
            CURRENT_FORMAT_VERSION,
            Some(operation_context.instance_details.version),
            Some(&exported_at),
        )
        .into(),
    );
    let mut section_texts = vec![
        EXPORT_COMMENT.to_owned(),
        toml::to_string(&header_document).map_err(write_failed)?,
    ];
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
                .map_err(write_failed)?;
        section_texts.push(section_text);
    }
    Ok(section_texts.join("\n"))
}

fn write_failed(write_error: toml::ser::Error) -> OperationError {
    OperationError::Internal(write_error.to_string())
}
