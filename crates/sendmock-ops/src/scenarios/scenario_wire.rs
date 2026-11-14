use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Body of `POST /api/v1/scenarios/validate` and `/run`: a scenario file's TOML text.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ScenarioRequest {
    /// The scenario file's text, in TOML.
    pub scenario: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct ScenarioProblem {
    /// One-based step number, or null for the whole file.
    #[schemars(required, schema_with = "crate::nullable_schema::<usize>")]
    pub step: Option<usize>,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct ScenarioValidation {
    pub is_valid: bool,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub name: Option<String>,
    pub step_count: usize,
    pub problems: Vec<ScenarioProblem>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ScenarioStepStatus {
    Passed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct ScenarioStepResult {
    /// One-based.
    pub step: usize,
    /// The operation, e.g. `webhook.endpoint.create`, or `http`, `assert`, `sleep`.
    pub run: String,
    pub status: ScenarioStepStatus,
    pub input: Value,
    pub output: Value,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub error: Option<String>,
    /// The name the step's output was saved under for later steps.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub saved_as: Option<String>,
    pub duration_ms: u64,
}

/// Answer of `POST /api/v1/scenarios/run`: a step-by-step report.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct ScenarioReport {
    pub name: String,
    pub is_passed: bool,
    pub started_at: String,
    pub duration_ms: u64,
    pub steps: Vec<ScenarioStepResult>,
}
