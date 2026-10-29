/// One attempt of a webhook delivery, as stored. JSON columns are documents the operations
/// layer owns.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WebhookDeliveryRecord {
    pub delivery_id: String,
    pub endpoint_id: String,
    pub endpoint_name: String,
    pub rule_id: Option<String>,
    /// The same for every attempt of one event to one endpoint; it becomes `webhook-id`.
    pub event_id: String,
    pub event_type: String,
    /// The email or SMS that caused the event.
    pub subject_id: Option<String>,
    /// `auto`, `manual` or `replay`.
    pub trigger: String,
    pub attempt: u32,
    /// `pending`, `render_failed`, `in_flight`, `succeeded`, `failed`, `exhausted` or `cancelled`.
    pub status: String,
    /// The endpoint's retry policy when the event was queued.
    pub retry_policy_json: String,
    /// The request before signing; none when rendering failed.
    pub rendered_request_json: Option<String>,
    /// The request as this attempt sent it, signature headers included.
    pub sent_request_json: Option<String>,
    pub response_json: Option<String>,
    pub duration_ms: Option<u32>,
    pub error_message: Option<String>,
    /// When this row is due: a `pending` row's send time, a `failed` row's retry time.
    pub next_attempt_at_unix_ms: Option<i64>,
    pub created_at_unix_ms: i64,
}

/// How an attempt ended.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeliveryAttemptResult {
    /// `succeeded`, `failed` or `exhausted`.
    pub status: String,
    pub sent_request_json: Option<String>,
    pub response_json: Option<String>,
    pub duration_ms: Option<u32>,
    pub error_message: Option<String>,
    /// Set on a `failed` attempt that will be retried.
    pub next_attempt_at_unix_ms: Option<i64>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WebhookDeliveryFilter {
    /// Any of these statuses; empty means every status.
    pub statuses: Vec<String>,
    pub endpoint_id: Option<String>,
    pub event_type: Option<String>,
    pub created_after_unix_ms: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WebhookDeliveryPage {
    pub deliveries: Vec<WebhookDeliveryRecord>,
    pub next_cursor: Option<String>,
    pub total_count: u64,
}
