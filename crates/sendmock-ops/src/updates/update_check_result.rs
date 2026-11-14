use schemars::JsonSchema;
use serde::Serialize;

use super::upgrade_command::InstallMethod;
use crate::ReleaseChannel;

/// The newer release an update check offers.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct AvailableRelease {
    pub version: String,
    pub published_at: String,
    /// The release's `CHANGELOG.md` section, in Markdown.
    pub release_notes_markdown: String,
    pub release_url: String,
    /// The command for the install method; null when the method is unknown, so follow `release_url`.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub upgrade_command: Option<String>,
}

/// The result of the opt-in update check.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub channel: ReleaseChannel,
    pub install_method: InstallMethod,
    /// False for edge and dev builds, which are offered no updates.
    pub is_channel_checked: bool,
    pub is_update_available: bool,
    /// Null when up to date or when the channel is not checked.
    #[schemars(required, schema_with = "crate::nullable_schema::<AvailableRelease>")]
    pub available_release: Option<AvailableRelease>,
    pub checked_at: String,
    /// True when the answer is the last check's, kept for 24 hours.
    pub is_from_cache: bool,
}
