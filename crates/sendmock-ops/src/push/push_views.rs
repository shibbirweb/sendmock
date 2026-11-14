use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::PushNotificationRecord;
use serde::Serialize;
use serde_json::Value;

fn read_json_text(json_text: &str) -> Value {
    serde_json::from_str(json_text).unwrap_or(Value::Null)
}

/// A push notification as the provider's API received it, with what SendMock answered.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct PushNotification {
    pub id: String,
    /// `fcm`, `expo` or `onesignal`.
    pub provider: String,
    /// The id the provider's answer named, such as FCM's message name.
    pub provider_message_id: String,
    /// The FCM registration token, Expo push token or OneSignal subscription it went to; a
    /// topic or condition send shows as `topic:<name>` or `condition:<expression>`.
    pub device_token: String,
    /// `android`, `ios` or `web` when the message targets one.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub platform: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub title: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub body: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub image_url: Option<String>,
    /// The data payload, key to value.
    pub data: Value,
    /// `sent`, or `failed` when the provider refused it.
    pub status: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub error_reason: Option<String>,
    /// The request body as the app sent it.
    pub request: Value,
    pub response_status: u16,
    /// What SendMock answered, in the provider's shape.
    pub response: Value,
    pub project: String,
    pub created_at: String,
}

impl From<PushNotificationRecord> for PushNotification {
    fn from(push_record: PushNotificationRecord) -> Self {
        Self {
            data: read_json_text(&push_record.data_json),
            request: read_json_text(&push_record.request_json),
            response: read_json_text(&push_record.response_json),
            created_at: format_rfc3339(push_record.created_at_unix_ms),
            id: push_record.push_id,
            provider: push_record.provider,
            provider_message_id: push_record.provider_message_id,
            device_token: push_record.device_token,
            platform: push_record.platform,
            title: push_record.title,
            body: push_record.body,
            image_url: push_record.image_url,
            status: push_record.status,
            error_reason: push_record.error_reason,
            response_status: push_record.response_status,
            project: push_record.project_key,
        }
    }
}
