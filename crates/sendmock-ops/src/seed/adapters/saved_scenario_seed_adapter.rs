use schemars::{Schema, SchemaGenerator, json_schema};
use sendmock_store::SavedScenarioRecord;

use crate::scenarios::check_scenario_file;
use crate::seed::seed_section_adapter::{CREATED_BY_SEED, SeedItem, impl_seed_section_adapter};
use crate::seed::seed_sections::SCENARIOS_SECTION;
use crate::{OperationContext, OperationError};

const DESCRIPTION_KEY: &str = "description";
const NAME_KEY: &str = "name";

/// `[[scenarios]]`, matched by `name`: the scenario file's own keys (`name`, `[[steps]]`) with
/// an optional `description`, so a scenario reads the same in a setup as in its own file.
pub struct SavedScenarioSeedAdapter;

/// The saved scenario's file: the item without its description, named after the scenario.
fn write_scenario_file(
    scenario_name: &str,
    mut item_table: toml::Table,
) -> Result<String, OperationError> {
    item_table.remove(DESCRIPTION_KEY);
    item_table.insert(NAME_KEY.to_owned(), toml::Value::from(scenario_name));
    toml::to_string(&item_table)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

fn read_text_field(item_table: &toml::Table, field_name: &str) -> String {
    item_table
        .get(field_name)
        .and_then(toml::Value::as_str)
        .map(|text| text.trim().to_owned())
        .unwrap_or_default()
}

/// A saved scenario's shape: a scenario file (`name`, `[[steps]]`) with a `description`.
fn describe_scenario_item_schema(_schema_generator: &mut SchemaGenerator) -> Schema {
    json_schema!({
        "description": "A saved scenario: the scenario file's own keys with an optional description, matched by name.",
        "type": "object",
        "required": ["name", "steps"],
        "properties": {
            "name": { "type": "string" },
            "description": { "type": "string" },
            "steps": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["run"],
                    "properties": {
                        "run": {
                            "description": "The operation, such as `email.list`, or `http`, `assert` or `sleep`.",
                            "type": "string"
                        },
                        "with": { "type": "object" },
                        "save": {
                            "description": "The name later steps read this step's output by.",
                            "type": "string"
                        }
                    }
                }
            }
        }
    })
}

impl SavedScenarioSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let scenario_name = read_text_field(&item_table, NAME_KEY);
        if scenario_name.is_empty() {
            return Err(OperationError::InvalidInput {
                message: "A saved scenario needs a name".to_owned(),
                field: Some(NAME_KEY.to_owned()),
            });
        }
        let description = read_text_field(&item_table, DESCRIPTION_KEY);
        let scenario_toml = write_scenario_file(&scenario_name, item_table)?;
        check_scenario_file(&scenario_toml)?;
        let saved_scenarios = &operation_context.setup_stores.saved_scenarios;
        let now_unix_ms = operation_context.clock.now_unix_ms();
        let seeded_scenario = match saved_scenarios
            .find_scenario_by_name(&scenario_name)
            .await?
        {
            Some(existing_scenario) => SavedScenarioRecord {
                description,
                scenario_toml,
                updated_at_unix_ms: now_unix_ms,
                ..existing_scenario
            },
            None => SavedScenarioRecord {
                scenario_id: operation_context.id_generator.generate_id().to_string(),
                name: scenario_name.clone(),
                description,
                scenario_toml,
                created_by: CREATED_BY_SEED.to_owned(),
                created_at_unix_ms: now_unix_ms,
                updated_at_unix_ms: now_unix_ms,
            },
        };
        saved_scenarios.save_scenario(seeded_scenario).await?;
        Ok(scenario_name)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_scenarios = operation_context
            .setup_stores
            .saved_scenarios
            .list_scenarios()
            .await?;
        stored_scenarios
            .into_iter()
            .map(|stored_scenario| {
                let mut item_table: toml::Table = stored_scenario.scenario_toml.parse().map_err(
                    |read_error: toml::de::Error| OperationError::Internal(read_error.to_string()),
                )?;
                item_table.insert(
                    NAME_KEY.to_owned(),
                    toml::Value::from(stored_scenario.name.clone()),
                );
                if !stored_scenario.description.is_empty() {
                    item_table.insert(
                        DESCRIPTION_KEY.to_owned(),
                        toml::Value::from(stored_scenario.description),
                    );
                }
                Ok(SeedItem {
                    item_key: stored_scenario.name.clone(),
                    item_name: stored_scenario.name,
                    table: item_table,
                })
            })
            .collect()
    }

    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let saved_scenarios = &operation_context.setup_stores.saved_scenarios;
        for stored_scenario in saved_scenarios.list_scenarios().await? {
            if !kept_item_keys.contains(&stored_scenario.name) {
                saved_scenarios
                    .delete_scenario(&stored_scenario.scenario_id)
                    .await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(
    SavedScenarioSeedAdapter,
    SCENARIOS_SECTION,
    schema = describe_scenario_item_schema
);
