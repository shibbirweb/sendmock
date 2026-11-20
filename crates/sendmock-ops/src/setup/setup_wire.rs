use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::setup_file_format::SetupFileFormat;
use crate::seed::SeedItemCount;

/// How an import treats the configuration the file does not hold.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum SetupImportMode {
    /// Adds and updates the file's items by name and keeps everything else.
    #[default]
    Merge,
    /// Also removes the configuration the file does not have, and puts settings the file
    /// leaves out back to their defaults.
    Replace,
}

/// Body of POST /api/v1/setup/export. No `Debug`, so the passphrase is never logged.
#[derive(Clone, Default, Deserialize, JsonSchema)]
pub struct SetupExportRequest {
    /// `toml` (the default), `json` or `yaml`.
    #[serde(default)]
    pub format: Option<SetupFileFormat>,
    /// Only these sections, such as `webhook.endpoints`, or groups, such as `webhook`; every
    /// section when empty.
    #[serde(default)]
    pub only: Vec<String>,
    /// Every section but these.
    #[serde(default)]
    pub except: Vec<String>,
    /// Write secrets encrypted with `passphrase` instead of as `${ENV_VAR}` references, to
    /// move the setup to your own machine.
    #[serde(default)]
    pub include_secrets: bool,
    /// The passphrase for `include_secrets`, 8 characters or more. The CLI reads
    /// `SENDMOCK_SETUP_PASSPHRASE` when the flag is not given.
    #[serde(default)]
    pub passphrase: Option<String>,
}

/// Body of POST /api/v1/setup/validate and /setup/import: the file's text, or a URL to
/// download it from. No `Debug`, so the passphrase and headers are never logged.
#[derive(Clone, Default, Deserialize, JsonSchema)]
pub struct SetupImportRequest {
    /// The setup file's text, in TOML, JSON or YAML; or give `url`.
    #[serde(default)]
    pub setup_text: Option<String>,
    /// Download the setup from this `https://` URL (plain `http://` only for loopback and
    /// private addresses): at most 1 MB, 10 seconds and 3 redirects, all to `https://`.
    #[serde(default)]
    pub url: Option<String>,
    /// The SHA-256 the download must have, as 64 hexadecimal digits.
    #[serde(default)]
    pub sha256: Option<String>,
    /// Headers for a private URL, each as `Name: value`; never shown or logged.
    #[serde(default)]
    pub headers: Vec<String>,
    /// `toml`, `json` or `yaml`, when the URL or the text does not say.
    #[serde(default)]
    pub format: Option<SetupFileFormat>,
    /// `merge` (the default) or `replace`.
    #[serde(default)]
    pub mode: SetupImportMode,
    /// Opens the file's encrypted secrets. The CLI reads `SENDMOCK_SETUP_PASSPHRASE` when the
    /// flag is not given.
    #[serde(default)]
    pub passphrase: Option<String>,
    /// For `replace` imports: how many items the validation said would be removed; the
    /// import is refused when it differs.
    #[serde(default)]
    pub confirm_removed_count: Option<usize>,
}

/// Body of POST /api/v1/setup/migrate.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct SetupMigrateRequest {
    /// The setup file's text.
    pub setup_text: String,
    /// The format of `setup_text`, when the text does not say.
    #[serde(default)]
    pub format: Option<SetupFileFormat>,
    /// The format to write the upgraded copy in; the same as the file's by default.
    #[serde(default)]
    pub to_format: Option<SetupFileFormat>,
}

/// What validating or importing a setup found, and per section what it adds, changes and
/// removes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct SetupValidation {
    pub is_valid: bool,
    /// The format the file was read as.
    pub format: SetupFileFormat,
    /// The file's format version (1 for a file without the `[sendmock]` header).
    pub format_version: i64,
    /// The format version an older file is upgraded from, in memory; null when it is current.
    #[schemars(required, schema_with = "crate::nullable_schema::<i64>")]
    pub upgraded_from_format_version: Option<i64>,
    /// Whether the file holds encrypted secrets, so the import needs the passphrase.
    pub has_encrypted_secrets: bool,
    pub errors: Vec<SetupValidationError>,
    /// How many items of each kind the file holds.
    pub summary: Vec<SeedItemCount>,
    /// Per section, the items the import adds, changes and removes; only sections with any.
    pub changes: Vec<SetupSectionChange>,
    /// How many items a `replace` import removes, for `confirm_removed_count`.
    pub removed_count: usize,
}

/// A problem in a setup, by line when the format keeps one and by key path otherwise.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct SetupValidationError {
    #[schemars(required, schema_with = "crate::nullable_schema::<usize>")]
    pub line: Option<usize>,
    /// The key path, such as `webhook.endpoints[0].secret`.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub location: Option<String>,
    pub message: String,
}

/// One section's changes, items named as the UI lists them.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct SetupSectionChange {
    /// The section, such as `webhook.endpoints`.
    pub section: String,
    pub item_kind: String,
    pub added: Vec<String>,
    pub changed: Vec<String>,
    pub removed: Vec<String>,
}
