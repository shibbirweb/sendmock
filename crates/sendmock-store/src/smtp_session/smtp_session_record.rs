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

/// Which sessions to list; every field narrows the list.
#[derive(Debug, Clone, Default)]
pub struct SmtpSessionFilter {
    /// `true` for rejected and aborted sessions, `false` for delivered ones.
    pub is_failed: Option<bool>,
    /// Part of the client address, EHLO name or AUTH user.
    pub search_text: Option<String>,
}
