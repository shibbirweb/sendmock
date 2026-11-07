use schemars::JsonSchema;
use serde::Deserialize;

/// `GET /api/v1/push` and `DELETE /api/v1/push`.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct PushListQuery {
    /// The next_cursor of the previous page.
    pub cursor: Option<String>,
    /// Items per page, 1 to 200 (default 50).
    pub limit: Option<u32>,
    /// Only this project's notifications (its key); every project's when not set.
    pub project: Option<String>,
    /// Only notifications to this device token.
    pub device_token: Option<String>,
    /// fcm, expo or onesignal.
    pub provider: Option<String>,
    /// sent or failed.
    pub status: Option<String>,
}

/// `DELETE /api/v1/push`: the list's filters without paging.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct PushFilterQuery {
    /// Only this project's notifications (its key); every project's when not set.
    pub project: Option<String>,
    /// Only notifications to this device token.
    pub device_token: Option<String>,
    /// fcm, expo or onesignal.
    pub provider: Option<String>,
    /// sent or failed.
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PushReference {
    /// The notification's id, from `GET /api/v1/push`.
    pub push_id: String,
}

/// `GET /api/v1/wait/push`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PushWaitQuery {
    /// The device token.
    pub device_token: Option<String>,
    /// Only this project's notifications (its key); every project's when not set.
    pub project: Option<String>,
    /// Only notifications sent after this time (default: 30 s ago).
    pub since: Option<String>,
    /// How long to wait, e.g. 10s (default 10s, at most 60s).
    pub timeout: Option<String>,
}
