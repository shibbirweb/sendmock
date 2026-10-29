use std::collections::BTreeMap;

/// A request to a provider path, after the `/providers/<key>` prefix is taken off.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ProviderHttpRequest {
    pub method: String,
    pub path: String,
    pub query_string: Option<String>,
    /// Names in lowercase.
    pub headers: BTreeMap<String, String>,
    pub body: Vec<u8>,
}

impl ProviderHttpRequest {
    pub fn header(&self, header_name: &str) -> Option<&str> {
        self.headers
            .get(&header_name.to_ascii_lowercase())
            .map(String::as_str)
    }

    /// The `Host` header without its port.
    pub fn host(&self) -> Option<&str> {
        self.header("host")
            .map(|host| host.split(':').next().unwrap_or(host))
    }
}

/// What SendMock answers, as the provider would.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderHttpResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

impl ProviderHttpResponse {
    /// SendMock's own `404`, for a path no enabled provider answers.
    pub fn native_not_found(message: &str) -> Self {
        Self {
            status: 404,
            headers: vec![("Content-Type".to_owned(), "application/json".to_owned())],
            body: serde_json::json!({ "error": { "code": "not_found", "message": message } })
                .to_string(),
        }
    }
}
