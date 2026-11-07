use schemars::JsonSchema;
use serde::Deserialize;

/// Query of `GET /api/v1/webhooks/deliveries`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct DeliveryListInput {
    /// The next_cursor of the previous page.
    pub cursor: Option<String>,
    /// Items per page, 1 to 200 (default 50).
    pub limit: Option<u32>,
    /// succeeded, failed or pending.
    pub status: Option<String>,
    /// Only this endpoint.
    pub endpoint_id: Option<String>,
    /// Only this event.
    pub event_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct DeliveryReference {
    /// The delivery's ID, from `GET /api/v1/webhooks/deliveries`.
    pub delivery_id: String,
}

/// Query of `GET /api/v1/wait/webhook`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WaitWebhookInput {
    /// The endpoint id or name.
    pub endpoint: Option<String>,
    /// The event type, e.g. email.received.
    pub event: Option<String>,
    /// succeeded or failed.
    pub status: Option<String>,
    /// Only match items newer than this time (default: 30 s ago).
    pub since: Option<String>,
    /// How long to wait, e.g. 10s (default 10s, at most 60s).
    pub timeout: Option<String>,
}
