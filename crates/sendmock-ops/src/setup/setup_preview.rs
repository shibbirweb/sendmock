use super::setup_secret_opener::find_encrypted_secret_spans;
use super::setup_secret_writer::SecretReferenceWriter;
use super::setup_wire::{SetupImportMode, SetupSectionChange};
use crate::seed::{
    SeedItem, SeedSection, read_item_key, read_section_items, seed_section_adapters,
};
use crate::{AppSettings, OperationContext, OperationError};

/// What a secret or environment reference compares as: its value is not in the file, so a
/// reference and an encrypted secret count as the same.
const HIDDEN_VALUE: &str = "${}";

/// Per section, what importing the setup would add, change and remove, judged against an
/// export of the stored configuration; only sections with a change are listed.
pub async fn preview_setup_changes(
    operation_context: &OperationContext,
    setup_document: &toml::Table,
    import_mode: SetupImportMode,
) -> Result<Vec<SetupSectionChange>, OperationError> {
    let mut section_changes = Vec::new();
    for section_adapter in seed_section_adapters() {
        let seed_section = section_adapter.section();
        let stored_items = section_adapter
            .export_items(operation_context, &SecretReferenceWriter)
            .await?;
        let file_items = read_section_items(setup_document, seed_section);
        let mut section_change = SetupSectionChange {
            section: seed_section.section_path.to_owned(),
            item_kind: seed_section.item_kind.to_owned(),
            added: Vec::new(),
            changed: Vec::new(),
            removed: Vec::new(),
        };
        if seed_section.is_item_list {
            compare_items(
                &mut section_change,
                seed_section,
                &file_items,
                &stored_items,
                |file_table| section_adapter.normalize_item(file_table),
                import_mode,
            );
        } else if settings_would_change(file_items.first(), &stored_items, import_mode)? {
            section_change
                .changed
                .push(seed_section.item_kind.to_owned());
        }
        let has_changes = !(section_change.added.is_empty()
            && section_change.changed.is_empty()
            && section_change.removed.is_empty());
        if has_changes {
            section_changes.push(section_change);
        }
    }
    Ok(section_changes)
}

/// How many items the changes remove.
pub fn count_removed_items(section_changes: &[SetupSectionChange]) -> usize {
    section_changes
        .iter()
        .map(|section_change| section_change.removed.len())
        .sum()
}

fn compare_items(
    section_change: &mut SetupSectionChange,
    seed_section: &SeedSection,
    file_items: &[toml::Table],
    stored_items: &[SeedItem],
    normalize_item: impl Fn(&toml::Table) -> toml::Table,
    import_mode: SetupImportMode,
) {
    let mut file_keys = Vec::new();
    for file_table in file_items {
        let item_key = read_item_key(seed_section, file_table);
        let stored_item = stored_items
            .iter()
            .find(|stored_item| stored_item.item_key == item_key);
        match stored_item {
            None => section_change.added.push(item_key.trim().to_owned()),
            Some(stored_item) => {
                if hide_references(&normalize_item(file_table))
                    != hide_references(&stored_item.table)
                {
                    section_change.changed.push(stored_item.item_name.clone());
                }
            }
        }
        file_keys.push(item_key);
    }
    if import_mode == SetupImportMode::Replace {
        section_change.removed.extend(
            stored_items
                .iter()
                .filter(|stored_item| !file_keys.contains(&stored_item.item_key))
                .map(|stored_item| stored_item.item_name.clone()),
        );
    }
}

/// The settings a file names are applied over the stored ones (merge) or over the defaults
/// (replace); they change when the result differs from what is stored.
fn settings_would_change(
    file_settings: Option<&toml::Table>,
    stored_items: &[SeedItem],
    import_mode: SetupImportMode,
) -> Result<bool, OperationError> {
    let stored_changes = stored_items
        .first()
        .map(|stored_item| stored_item.table.clone())
        .unwrap_or_default();
    let default_settings = write_default_settings()?;
    let mut settings_after = match import_mode {
        SetupImportMode::Merge => stored_changes.clone(),
        SetupImportMode::Replace => toml::Table::new(),
    };
    for (setting_name, setting_value) in file_settings.into_iter().flatten() {
        settings_after.insert(setting_name.clone(), setting_value.clone());
    }
    settings_after.retain(|setting_name, setting_value| {
        default_settings.get(setting_name) != Some(setting_value)
    });
    Ok(settings_after != stored_changes)
}

fn write_default_settings() -> Result<toml::Table, OperationError> {
    let default_fields = serde_json::to_value(AppSettings::default())
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    let mut default_settings = toml::Table::new();
    for (setting_name, setting_value) in default_fields.as_object().into_iter().flatten() {
        if let Ok(toml_value) = toml::Value::try_from(setting_value) {
            default_settings.insert(setting_name.clone(), toml_value);
        }
    }
    Ok(default_settings)
}

/// The table with every `${NAME}` reference and encrypted secret replaced by one marker.
fn hide_references(item_table: &toml::Table) -> toml::Value {
    let mut hidden_value = toml::Value::Table(item_table.clone());
    hide_value_references(&mut hidden_value);
    hidden_value
}

fn hide_value_references(item_value: &mut toml::Value) {
    match item_value {
        toml::Value::String(text) => *text = hide_text_references(text),
        toml::Value::Array(items) => items.iter_mut().for_each(hide_value_references),
        toml::Value::Table(table) => table
            .iter_mut()
            .for_each(|(_, table_value)| hide_value_references(table_value)),
        toml::Value::Integer(_)
        | toml::Value::Float(_)
        | toml::Value::Boolean(_)
        | toml::Value::Datetime(_) => {}
    }
}

fn hide_text_references(text: &str) -> String {
    let mut hidden_text = String::with_capacity(text.len());
    let mut copied_until = 0;
    for secret_span in find_encrypted_secret_spans(text) {
        hidden_text.push_str(&text[copied_until..secret_span.start]);
        hidden_text.push_str(HIDDEN_VALUE);
        copied_until = secret_span.end;
    }
    hidden_text.push_str(&text[copied_until..]);
    let mut result_text = String::with_capacity(hidden_text.len());
    let mut remaining_text = hidden_text.as_str();
    while let Some(opening_index) = remaining_text.find("${") {
        result_text.push_str(&remaining_text[..opening_index]);
        let after_opening = &remaining_text[opening_index + 2..];
        match after_opening.find('}') {
            Some(closing_index) => {
                result_text.push_str(HIDDEN_VALUE);
                remaining_text = &after_opening[closing_index + 1..];
            }
            None => {
                result_text.push_str(&remaining_text[opening_index..]);
                remaining_text = "";
            }
        }
    }
    result_text.push_str(remaining_text);
    result_text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_reference_and_an_encrypted_secret_compare_the_same() {
        let encrypted_secret = format!("encrypted:v1:{}:{}", "A".repeat(22), "A".repeat(40));

        assert_eq!(hide_text_references("${BILLING_SECRET}"), HIDDEN_VALUE);
        assert_eq!(hide_text_references(&encrypted_secret), HIDDEN_VALUE);
        assert_eq!(
            hide_text_references("{\"value\":\"${KEY_SECRET}\",\"id\":\"x\"}"),
            "{\"value\":\"${}\",\"id\":\"x\"}"
        );
        assert_eq!(hide_text_references("plain ${unclosed"), "plain ${unclosed");
    }
}
