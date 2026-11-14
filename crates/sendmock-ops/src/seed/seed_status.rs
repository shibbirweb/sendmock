use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use serde::Serialize;

use super::seed_application::{AppliedSeedItem, export_seed_items};
use crate::{OperationContext, OperationError};

/// `GET /api/v1/seed/status`.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SeedStatus {
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub source_path: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub applied_at: Option<String>,
    /// Configuration added or edited since the seed was applied.
    pub changed_items: Vec<SeedChangedItem>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum SeedItemChange {
    Added,
    Edited,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct SeedChangedItem {
    /// What kind of item, e.g. "Virtual number" or "Webhook endpoint".
    pub item_kind: String,
    pub item_name: String,
    pub change: SeedItemChange,
}

/// Compares the configuration now with the one the last seed left.
pub async fn load_seed_status(
    operation_context: &OperationContext,
) -> Result<SeedStatus, OperationError> {
    let Some(seed_state) = operation_context.seed_state_repository.find_state().await? else {
        return Ok(SeedStatus {
            source_path: None,
            applied_at: None,
            changed_items: Vec::new(),
        });
    };
    let applied_items: Vec<AppliedSeedItem> =
        serde_json::from_str(&seed_state.applied_items_json).unwrap_or_default();
    let current_items = export_seed_items(operation_context).await?;
    Ok(SeedStatus {
        source_path: seed_state.source_path,
        applied_at: Some(format_rfc3339(seed_state.applied_at_unix_ms)),
        changed_items: list_changed_items(&applied_items, current_items),
    })
}

fn list_changed_items(
    applied_items: &[AppliedSeedItem],
    current_items: Vec<AppliedSeedItem>,
) -> Vec<SeedChangedItem> {
    current_items
        .into_iter()
        .filter_map(|current_item| {
            let applied_item = applied_items.iter().find(|applied_item| {
                applied_item.section_path == current_item.section_path
                    && applied_item.item_key == current_item.item_key
            });
            let change = match applied_item {
                None => SeedItemChange::Added,
                Some(applied_item) if applied_item.table != current_item.table => {
                    SeedItemChange::Edited
                }
                Some(_) => return None,
            };
            Some(SeedChangedItem {
                item_kind: current_item.item_kind,
                item_name: current_item.item_name,
                change,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seed_item(item_key: &str, label: &str) -> AppliedSeedItem {
        let mut table = toml::Table::new();
        table.insert("label".to_owned(), toml::Value::from(label));
        AppliedSeedItem {
            section_path: "numbers".to_owned(),
            item_kind: "Virtual number".to_owned(),
            item_key: item_key.to_owned(),
            item_name: item_key.to_owned(),
            table,
        }
    }

    #[test]
    fn lists_added_and_edited_items_and_skips_unchanged_ones() {
        let applied_items = [seed_item("+1555", "Support"), seed_item("+1666", "Sales")];
        let current_items = vec![
            seed_item("+1555", "Support"),
            seed_item("+1666", "Sales team"),
            seed_item("+1777", "Alerts"),
        ];

        let changed_items = list_changed_items(&applied_items, current_items);

        assert_eq!(
            changed_items
                .iter()
                .map(|changed_item| (changed_item.item_name.as_str(), changed_item.change))
                .collect::<Vec<_>>(),
            [
                ("+1666", SeedItemChange::Edited),
                ("+1777", SeedItemChange::Added)
            ]
        );
    }
}
