use sendmock_core::format_rfc3339;

use super::adapters::seed_section_adapters;
use crate::setup::{
    CURRENT_FORMAT_VERSION, ExportedSection, SetupFileFormat, build_setup_header,
    write_setup_export,
};
use crate::{OperationContext, OperationError};

/// The configuration as a TOML setup file (see `write_setup_text`).
pub async fn write_seed_toml(
    operation_context: &OperationContext,
) -> Result<String, OperationError> {
    write_setup_text(operation_context, SetupFileFormat::Toml).await
}

/// The configuration as a setup file in the chosen format: the `[sendmock]` header naming the
/// format version, this release and the time, then each section in apply order; secrets are
/// `${ENV_VAR}` references, never their values, and empty sections are left out.
pub async fn write_setup_text(
    operation_context: &OperationContext,
    setup_format: SetupFileFormat,
) -> Result<String, OperationError> {
    let exported_at = format_rfc3339(operation_context.clock.now_unix_ms());
    let setup_header = build_setup_header(
        CURRENT_FORMAT_VERSION,
        Some(operation_context.instance_details.version),
        Some(&exported_at),
    );
    let mut exported_sections = Vec::new();
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
        exported_sections.push(ExportedSection {
            seed_section: section_adapter.section(),
            items: section_tables,
        });
    }
    write_setup_export(setup_header, exported_sections, setup_format)
}
