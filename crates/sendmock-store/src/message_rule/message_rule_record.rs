/// Which list a message rule belongs to; each has its own table and order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageRuleKind {
    Tag,
    Forward,
}

impl MessageRuleKind {
    pub(crate) fn table_name(self) -> &'static str {
        match self {
            Self::Tag => "tag_rules",
            Self::Forward => "forward_rules",
        }
    }
}

/// A tag or forward rule as stored; `position` is one-based with no gaps.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageRuleRecord {
    pub rule_id: String,
    pub position: u32,
    pub name: String,
    /// The webhook rule filter as JSON; `None` matches every email.
    pub filter_json: Option<String>,
    /// The tag a tag rule adds, or the JSON list of addresses a forward rule sends to.
    pub action: String,
    pub is_enabled: bool,
    pub created_at_unix_ms: i64,
}
