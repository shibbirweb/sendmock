/// One open of an email or SMS, as the open history lists it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageOpenRecord {
    pub opened_at_unix_ms: i64,
    /// `ui`, `manual` or `api`.
    pub source: String,
    pub user_agent: Option<String>,
}

/// Whether an open is recorded on any message, or only on one nobody has opened yet.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenRecording {
    Always,
    OnlyIfUnopened,
}
