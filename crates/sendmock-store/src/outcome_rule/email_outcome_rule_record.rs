/// A custom outcome address as stored; `position` is one-based with no gaps.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailOutcomeRuleRecord {
    pub rule_id: String,
    pub position: u32,
    pub pattern: String,
    /// `delivered`, `hard_bounce`, `soft_bounce`, `complaint`, `unsubscribe` or `reject`.
    pub outcome: String,
    /// The SMTP reply for bounces and rejects, e.g. `550 5.1.1`.
    pub smtp_code: Option<String>,
    pub diagnostic: Option<String>,
    pub note: String,
    pub is_enabled: bool,
    /// `ui`, `api`, `cli`, `mcp` or `seed`.
    pub created_by: String,
    pub created_at_unix_ms: i64,
}
