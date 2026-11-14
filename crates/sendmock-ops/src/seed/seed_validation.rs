use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Body of POST /api/v1/seed/validate and /seed/apply.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SeedFileRequest {
    /// The seed file's text (`sendmock.seed.toml`).
    pub seed_toml: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct SeedValidation {
    pub is_valid: bool,
    pub errors: Vec<SeedValidationError>,
    /// How many items of each kind the file would create or update.
    pub summary: Vec<SeedItemCount>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct SeedValidationError {
    pub line: usize,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct SeedItemCount {
    pub item_kind: &'static str,
    pub item_count: usize,
}
