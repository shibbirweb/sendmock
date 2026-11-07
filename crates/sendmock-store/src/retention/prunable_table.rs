/// A table of traffic that retention trims: its key, the column that dates a row and which
/// rows may go at all. Configuration tables are never listed here.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PrunableTable {
    pub table_name: &'static str,
    pub key_column: &'static str,
    pub time_column: &'static str,
    /// An SQL condition the rows must meet to be pruned.
    pub prunable_rows: &'static str,
}

impl PrunableTable {
    pub const EMAILS: Self = Self::every_row("emails", "id", "received_at");
    pub const SMTP_SESSIONS: Self = Self::every_row("smtp_sessions", "id", "started_at");
    pub const API_REQUESTS: Self = Self::every_row("api_requests", "id", "created_at");
    pub const HTTP_REQUESTS: Self = Self::every_row("http_captured_requests", "id", "created_at");
    pub const SMS_MESSAGES: Self = Self::every_row("sms_messages", "id", "created_at");
    pub const VERIFICATIONS: Self = Self::every_row("verifications", "sid", "created_at");
    pub const PUSH_NOTIFICATIONS: Self = Self::every_row("push_notifications", "id", "created_at");
    pub const WHATSAPP_MEDIA: Self = Self::every_row("whatsapp_media", "id", "created_at");
    /// Only finished deliveries: one still queued, sending or waiting for a retry stays.
    pub const WEBHOOK_DELIVERIES: Self = Self {
        table_name: "webhook_deliveries",
        key_column: "id",
        time_column: "created_at",
        prunable_rows: "status NOT IN ('pending', 'in_flight') AND next_attempt_at IS NULL",
    };

    const fn every_row(
        table_name: &'static str,
        key_column: &'static str,
        time_column: &'static str,
    ) -> Self {
        Self {
            table_name,
            key_column,
            time_column,
            prunable_rows: "1 = 1",
        }
    }

    /// Deletes up to `?2` prunable rows dated before `?1`.
    pub fn delete_older_batch_statement(&self) -> String {
        let Self {
            table_name,
            key_column,
            time_column,
            prunable_rows,
        } = self;
        format!(
            "DELETE FROM {table_name} WHERE {key_column} IN (SELECT {key_column} FROM {table_name} \
             WHERE ({prunable_rows}) AND {time_column} < ?1 LIMIT ?2)"
        )
    }

    /// Deletes up to `?2` prunable rows past the newest `?1`. Rows are ordered by their date,
    /// since some keys are random rather than time-ordered.
    pub fn delete_beyond_count_batch_statement(&self) -> String {
        let Self {
            table_name,
            key_column,
            time_column,
            prunable_rows,
        } = self;
        format!(
            "DELETE FROM {table_name} WHERE {key_column} IN (SELECT {key_column} FROM {table_name} \
             WHERE ({prunable_rows}) ORDER BY {time_column} DESC, {key_column} DESC LIMIT ?2 OFFSET ?1)"
        )
    }
}
