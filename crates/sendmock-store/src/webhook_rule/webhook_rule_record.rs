/// A webhook rule as stored; `position` is one-based with no gaps.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WebhookRuleRecord {
    pub rule_id: String,
    pub position: u32,
    pub name: String,
    pub endpoint_id: String,
    /// The event types the rule listens to, as a JSON array.
    pub events_json: String,
    /// The filter as a JSON document; none passes every event.
    pub filter_json: Option<String>,
    pub is_enabled: bool,
    /// `ui`, `api`, `cli`, `mcp` or `seed`.
    pub created_by: String,
    pub created_at_unix_ms: i64,
}
