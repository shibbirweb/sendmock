/// One call to a message's status callback URL; request and response are JSON documents.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmsCallbackAttemptRecord {
    pub attempt_id: String,
    pub sms_id: String,
    pub reported_status: String,
    pub attempt: u32,
    /// `pending`, `in_flight`, `succeeded`, `failed` or `exhausted`.
    pub status: String,
    /// The request as rendered for the first attempt; every retry sends it again.
    pub request_json: String,
    pub response_json: Option<String>,
    pub duration_ms: Option<u64>,
    pub error_message: Option<String>,
    /// When this row is due: a `pending` row's send time, a `failed` row's retry time.
    pub next_attempt_at_unix_ms: Option<i64>,
    pub created_at_unix_ms: i64,
}

/// How an `in_flight` attempt ended.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CallbackAttemptResult {
    /// `succeeded`, `failed` or `exhausted`.
    pub status: String,
    pub response_json: Option<String>,
    pub duration_ms: Option<u64>,
    pub error_message: Option<String>,
    /// Set when a retry is due.
    pub next_attempt_at_unix_ms: Option<i64>,
}
