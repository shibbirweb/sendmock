/// A push notification as a provider's API received it, with what SendMock answered.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PushNotificationRecord {
    pub push_id: String,
    /// `fcm`, `expo` or `onesignal`.
    pub provider: String,
    /// The id the provider's answer named, such as FCM's message name.
    pub provider_message_id: String,
    /// The FCM registration token, Expo push token or OneSignal subscription it went to.
    pub device_token: String,
    /// `android`, `ios` or `web` when the message targets one.
    pub platform: Option<String>,
    pub title: Option<String>,
    pub body: Option<String>,
    pub image_url: Option<String>,
    pub data_json: String,
    /// `sent`, or `failed` when a magic token made the provider refuse it.
    pub status: String,
    pub error_reason: Option<String>,
    pub request_json: String,
    pub response_status: u16,
    pub response_json: String,
    pub project_key: String,
    pub created_at_unix_ms: i64,
}

/// Which notifications a list returns; every set condition must hold.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PushNotificationFilter {
    pub project_key: Option<String>,
    pub device_token: Option<String>,
    pub provider: Option<String>,
    pub status: Option<String>,
    pub created_after_unix_ms: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PushNotificationPage {
    pub notifications: Vec<PushNotificationRecord>,
    pub next_cursor: Option<String>,
    pub total_count: u64,
}
