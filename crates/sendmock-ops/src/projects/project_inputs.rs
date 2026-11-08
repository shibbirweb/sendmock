use schemars::JsonSchema;
use serde::Deserialize;

/// Body of `POST /api/v1/projects`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ProjectInput {
    /// What apps send to pick the project: lowercase letters, digits and dashes, 1 to 40
    /// characters, starting with a letter or digit. It never changes.
    pub key: String,
    /// A name for the project, shown in the UI.
    pub name: String,
}

/// `PATCH /api/v1/projects/{projectKey}`: the new name.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ProjectUpdate {
    /// The project's key, from the list of projects.
    pub project_key: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ProjectReference {
    /// The project's key, from the list of projects.
    pub project_key: String,
}
