/// A webhook endpoint as stored.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WebhookEndpointRecord {
    pub endpoint_id: String,
    pub name: String,
    pub url: String,
    pub is_enabled: bool,
    /// The method, headers, body, retry policy and other request settings as a JSON document.
    pub request_settings_json: String,
    /// A detached endpoint's own copy of its template as JSON; None while it is linked.
    pub detached_template_json: Option<String>,
    /// The `whsec_` secret deliveries are signed with.
    pub signing_secret: String,
    /// The secret before the last rotation, still signing until it expires.
    pub previous_signing_secret: Option<String>,
    pub previous_secret_expires_at_unix_ms: Option<i64>,
    /// `ui`, `api`, `cli`, `mcp` or `seed`.
    pub created_by: String,
    pub created_at_unix_ms: i64,
}

/// A new signing secret and how long the current one keeps signing next to it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WebhookSecretRotation {
    pub new_signing_secret: String,
    pub previous_secret_expires_at_unix_ms: i64,
}
