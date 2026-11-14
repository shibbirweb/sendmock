/// A custom outcome number as stored; `position` is one-based with no gaps.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmsOutcomeRuleRecord {
    pub rule_id: String,
    pub position: u32,
    /// `to` or `from`.
    pub match_field: String,
    pub pattern: String,
    /// `reject`, `undelivered`, `failed`, `delayed_delivery` or `read`.
    pub outcome: String,
    pub error_code: Option<String>,
    pub delay_seconds: Option<u32>,
    pub note: String,
    pub is_enabled: bool,
    /// `ui`, `api`, `cli`, `mcp` or `seed`.
    pub created_by: String,
    pub created_at_unix_ms: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuleMoveDirection {
    Up,
    Down,
}
