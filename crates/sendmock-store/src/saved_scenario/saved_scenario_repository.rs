use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use crate::{Database, StoreError};

const SCENARIO_COLUMNS: &str =
    "id, name, description, scenario_toml, created_by, created_at, updated_at";

/// A scenario saved by name, with its file as written.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SavedScenarioRecord {
    pub scenario_id: String,
    pub name: String,
    pub description: String,
    pub scenario_toml: String,
    pub created_by: String,
    pub created_at_unix_ms: i64,
    pub updated_at_unix_ms: i64,
}

/// Saved scenarios, listed by name.
#[derive(Clone)]
pub struct SavedScenarioRepository {
    database: Arc<Database>,
}

fn read_scenario_row(row: &Row<'_>) -> rusqlite::Result<SavedScenarioRecord> {
    Ok(SavedScenarioRecord {
        scenario_id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        scenario_toml: row.get(3)?,
        created_by: row.get(4)?,
        created_at_unix_ms: row.get(5)?,
        updated_at_unix_ms: row.get(6)?,
    })
}

impl SavedScenarioRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn list_scenarios(&self) -> Result<Vec<SavedScenarioRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {SCENARIO_COLUMNS} FROM saved_scenarios ORDER BY name COLLATE NOCASE, rowid"
                ))?;
                let scenarios = statement
                    .query_map([], read_scenario_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(scenarios)
            })
            .await
    }

    pub async fn find_scenario(
        &self,
        scenario_id: &str,
    ) -> Result<Option<SavedScenarioRecord>, StoreError> {
        self.find_by_column("id", scenario_id).await
    }

    pub async fn find_scenario_by_name(
        &self,
        scenario_name: &str,
    ) -> Result<Option<SavedScenarioRecord>, StoreError> {
        self.find_by_column("name", scenario_name).await
    }

    async fn find_by_column(
        &self,
        column_name: &'static str,
        column_value: &str,
    ) -> Result<Option<SavedScenarioRecord>, StoreError> {
        let column_value = column_value.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!(
                            "SELECT {SCENARIO_COLUMNS} FROM saved_scenarios WHERE {column_name} = ?1"
                        ),
                        [column_value],
                        read_scenario_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Inserts a new scenario or replaces the one with the same id.
    pub async fn save_scenario(&self, scenario: SavedScenarioRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT OR REPLACE INTO saved_scenarios ({SCENARIO_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"),
                    params![
                        scenario.scenario_id,
                        scenario.name,
                        scenario.description,
                        scenario.scenario_toml,
                        scenario.created_by,
                        scenario.created_at_unix_ms,
                        scenario.updated_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn delete_scenario(&self, scenario_id: &str) -> Result<bool, StoreError> {
        let scenario_id = scenario_id.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection
                    .execute("DELETE FROM saved_scenarios WHERE id = ?1", [scenario_id])?
                    > 0)
            })
            .await
    }
}
