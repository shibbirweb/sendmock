/// A bin as stored; the default reply and the rules are the operations' JSON.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpBinRecord {
    pub bin_id: String,
    pub name: String,
    pub preset: Option<String>,
    pub default_response_json: String,
    pub rules_json: String,
    pub created_at_unix_ms: i64,
    /// Read with the bin, from its captured requests.
    pub request_count: u64,
    pub last_request_at_unix_ms: Option<i64>,
}

/// A file uploaded in a captured multipart request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CapturedFileRecord {
    pub file_index: u32,
    pub field_name: String,
    pub filename: String,
    pub content_type: String,
    pub size_bytes: u64,
    /// Empty when listed; filled when one file is read.
    pub content: Vec<u8>,
}

/// A captured request and what SendMock answered.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CapturedRequestRecord {
    pub request_id: String,
    pub bin_id: String,
    pub bin_name: String,
    pub method: String,
    pub url: String,
    pub path: String,
    pub query_json: String,
    pub headers_json: String,
    pub body: String,
    pub content_type: Option<String>,
    pub client_ip: String,
    pub response_status: u16,
    pub response_headers_json: String,
    pub response_body: String,
    pub matched_rule_id: Option<String>,
    pub matched_rule_name: Option<String>,
    pub is_simulated_failure: bool,
    pub duration_ms: u32,
    pub created_at_unix_ms: i64,
    pub files: Vec<CapturedFileRecord>,
}
