use schemars::JsonSchema;
use serde::Serialize;

use crate::ReleaseChannel;

/// Answer of `GET /info`: version, listen addresses and the database.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct AppInfo {
    pub version: String,
    pub channel: ReleaseChannel,
    pub uptime_seconds: u64,
    pub smtp_address: String,
    pub http_address: String,
    /// Always present, null when the provider port is off, as the contract requires.
    #[schemars(required)]
    pub provider_address: Option<String>,
    pub database_path: String,
    pub database_size_bytes: u64,
    /// True when SendMock runs in Docker, so the UI defaults to container hostnames.
    pub is_container: bool,
    /// The `operationId`s this binary serves; the UI shows Not available yet for the rest.
    pub available_operations: Vec<String>,
}
