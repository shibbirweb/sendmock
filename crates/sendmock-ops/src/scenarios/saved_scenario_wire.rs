use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::SavedScenarioRecord;
use serde::{Deserialize, Serialize};

/// A scenario saved by name (AI-07), with its file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct SavedScenario {
    pub id: String,
    pub name: String,
    pub description: String,
    /// The scenario file's text, in TOML.
    pub scenario: String,
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<SavedScenarioRecord> for SavedScenario {
    fn from(stored_scenario: SavedScenarioRecord) -> Self {
        Self {
            id: stored_scenario.scenario_id,
            name: stored_scenario.name,
            description: stored_scenario.description,
            scenario: stored_scenario.scenario_toml,
            created_by: stored_scenario.created_by,
            created_at: format_rfc3339(stored_scenario.created_at_unix_ms),
            updated_at: format_rfc3339(stored_scenario.updated_at_unix_ms),
        }
    }
}

/// Body of `POST /api/v1/scenarios`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SavedScenarioInput {
    /// Unique among saved scenarios.
    pub name: String,
    #[serde(default)]
    pub description: String,
    /// The scenario file's text, in TOML; checked as `scenario validate` does.
    pub scenario: String,
}

/// `PATCH /api/v1/scenarios/{scenarioId}`: only the changed keys.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SavedScenarioUpdate {
    /// The scenario's id or name.
    pub scenario_id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub scenario: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SavedScenarioReference {
    /// The scenario's id or name.
    pub scenario_id: String,
}
