/// One SMTP session as the session log stores it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmtpSessionRecord {
    pub session_id: String,
    pub started_at_unix_ms: i64,
    pub ended_at_unix_ms: i64,
    pub remote_address: String,
    pub helo_name: String,
    pub tls_version: Option<String>,
    pub auth_mechanism: Option<String>,
    pub auth_user: Option<String>,
    /// `delivered`, `rejected` or `aborted`.
    pub result: String,
    pub failure_reason: Option<String>,
    pub email_ids: Vec<String>,
    pub transcript: String,
}

/// One page of sessions, newest first.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmtpSessionPage {
    pub sessions: Vec<SmtpSessionRecord>,
    pub next_cursor: Option<String>,
    pub total_count: u64,
}
