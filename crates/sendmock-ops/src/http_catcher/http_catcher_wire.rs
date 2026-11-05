use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// What a bin or rule answers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct HttpMockResponse {
    pub status_code: u16,
    pub headers: BTreeMap<String, String>,
    /// A template that can echo the request.
    pub body: String,
}

/// The service a bin stands in for; its default reply mimics the real one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HttpBinPreset {
    Slack,
    Discord,
    Teams,
    GoogleChat,
    Telegram,
    Fcm,
    Expo,
    Onesignal,
    Generic,
}

/// A capture URL with its own default reply and response rules.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct HttpBin {
    pub id: String,
    pub name: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<HttpBinPreset>")]
    pub preset: Option<HttpBinPreset>,
    pub request_count: u64,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub last_request_at: Option<String>,
    pub default_response: HttpMockResponse,
}

/// Body of `POST /api/v1/http/bins`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct HttpBinInput {
    /// The bin's name, its path under `/catch/`.
    pub name: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<HttpBinPreset>")]
    pub preset: Option<HttpBinPreset>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct HttpBinUpdate {
    /// The bin's ID, from `GET /api/v1/http/bins`.
    pub bin_id: String,
    pub default_response: HttpMockResponse,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct HttpBinReference {
    /// The bin's ID, from `GET /api/v1/http/bins`.
    pub bin_id: String,
}

/// A file uploaded in a captured multipart request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct CapturedHttpFile {
    pub file_index: u32,
    pub field_name: String,
    pub filename: String,
    pub content_type: String,
    pub size_bytes: u64,
}

/// A captured request and what SendMock answered.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct CapturedHttpRequest {
    pub id: String,
    pub bin_id: String,
    pub bin_name: String,
    pub method: String,
    pub url: String,
    pub path: String,
    pub query: BTreeMap<String, String>,
    pub headers: BTreeMap<String, String>,
    pub body: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub content_type: Option<String>,
    pub files: Vec<CapturedHttpFile>,
    pub client_ip: String,
    pub response_status: u16,
    pub response_headers: BTreeMap<String, String>,
    pub response_body: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub matched_rule_id: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub matched_rule_name: Option<String>,
    pub is_simulated_failure: bool,
    pub duration_ms: u32,
    pub created_at: String,
}
