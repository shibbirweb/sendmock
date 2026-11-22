use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::seed::SeedItemCount;

/// A preset's option, with the value used when it is left out.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct PresetOptionView {
    pub name: String,
    pub default_value: String,
    pub description: String,
}

/// A stack preset, as `GET /api/v1/presets` lists it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct StackPreset {
    pub name: String,
    pub description: String,
    pub options: Vec<PresetOptionView>,
}

/// Body of `POST /api/v1/presets/{presetName}/apply`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PresetApplyInput {
    /// The preset's name, from `GET /api/v1/presets`.
    pub preset_name: String,
    /// Where SendMock reaches your app, such as `http://localhost:8000`.
    pub app_url: String,
    /// The preset's options by name (its webhook paths); left out, their defaults.
    #[serde(default)]
    pub options: BTreeMap<String, String>,
    /// Numbers to add, one per line: `number,label,subaccount_sid,messaging_service_sid`
    /// (a first line starting with `number` is a header); the last two may be empty.
    #[serde(default)]
    #[schemars(schema_with = "crate::nullable_schema::<String>")]
    pub numbers_csv: Option<String>,
}

/// What applying a preset did, and what your app needs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct PresetApplyResult {
    pub preset_name: String,
    /// The items its setup file created or updated, by kind.
    pub applied: Vec<SeedItemCount>,
    /// What else it did: the signing key, the Debugger URL, the numbers.
    pub steps: Vec<String>,
    /// SMTP, the provider port and the HTTPS provider port, as this SendMock serves them.
    pub smtp_address: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub provider_address: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub provider_tls_address: Option<String>,
    /// What to fix, such as an HTTPS provider port that is off.
    pub warnings: Vec<String>,
    /// The lines for your app's `.env`; secrets are hidden from AI agents.
    pub env_block: String,
}
