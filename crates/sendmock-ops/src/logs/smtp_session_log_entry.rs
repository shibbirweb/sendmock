use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::SmtpSessionRecord;
use serde::Serialize;

/// One SMTP session as the Logs screen shows it.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SmtpSessionLogEntry {
    pub id: String,
    pub remote_address: String,
    pub helo_name: String,
    #[schemars(required)]
    pub tls_version: Option<String>,
    #[schemars(required)]
    pub auth_mechanism: Option<String>,
    #[schemars(required)]
    pub auth_user: Option<String>,
    /// `delivered`, `rejected` or `aborted`.
    pub result: String,
    #[schemars(required)]
    pub failure_reason: Option<String>,
    pub email_ids: Vec<String>,
    /// One line per command or reply, prefixed `C: ` (client) or `S: ` (server).
    pub transcript: String,
    pub started_at: String,
    pub ended_at: String,
}

impl From<SmtpSessionRecord> for SmtpSessionLogEntry {
    fn from(session: SmtpSessionRecord) -> Self {
        Self {
            id: session.session_id,
            remote_address: session.remote_address,
            helo_name: session.helo_name,
            tls_version: session.tls_version,
            auth_mechanism: session.auth_mechanism,
            auth_user: session.auth_user,
            result: session.result,
            failure_reason: session.failure_reason,
            email_ids: session.email_ids,
            transcript: session.transcript,
            started_at: format_rfc3339(session.started_at_unix_ms),
            ended_at: format_rfc3339(session.ended_at_unix_ms),
        }
    }
}
