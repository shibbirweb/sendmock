/// A stored provider: a built-in changed or removed, or a custom provider.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageProviderRecord {
    /// `email` or `sms`.
    pub area: String,
    pub provider_key: String,
    /// The definition as JSON; `None` for a built-in kept as shipped.
    pub definition_json: Option<String>,
    pub is_removed: bool,
    pub updated_at_unix_ms: i64,
}
