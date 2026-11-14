use schemars::JsonSchema;
use serde::Serialize;

/// Answer of `GET /health`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct HealthStatus {
    pub status: HealthState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum HealthState {
    Ok,
}
