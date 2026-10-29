use std::collections::BTreeMap;

use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::{
    SmsCallbackAttemptRecord, SmsMediaRecord, SmsRecord, SmsStatusChangeRecord, SmsThreadRecord,
};
use serde::Serialize;
use serde_json::Value;

use crate::email::ExtractedData;

/// One MMS or WhatsApp media file stored with a message.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SmsMediaView {
    pub media_index: u32,
    pub content_type: String,
    #[schemars(required)]
    pub size_bytes: Option<u64>,
    #[schemars(required)]
    pub filename: Option<String>,
    /// Where the app said to fetch it (`MediaUrl`), null for inline files.
    #[schemars(required)]
    pub source_url: Option<String>,
    /// SendMock's copy: `/api/v1/sms/{smsId}/media/{mediaIndex}`.
    pub url: String,
}

/// A message as lists and events show it.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SmsMessage {
    pub id: String,
    pub provider_id: String,
    pub direction: String,
    pub channel: String,
    pub api: String,
    pub from_number: String,
    pub to_number: String,
    pub body: String,
    pub encoding: String,
    pub segments: u32,
    pub media: Vec<SmsMediaView>,
    pub status: String,
    #[schemars(required)]
    pub error_code: Option<String>,
    #[schemars(required)]
    pub status_callback_url: Option<String>,
    #[schemars(required)]
    pub messaging_service_sid: Option<String>,
    #[schemars(required)]
    pub account: Option<String>,
    pub extracted: ExtractedData,
    #[schemars(required)]
    pub opened_at: Option<String>,
    pub open_count: u64,
    /// Inbound only: what the number's reply webhook answered; null until Phase 3.
    #[schemars(required)]
    pub reply_webhook: Option<Value>,
    /// A TwiML reply: the inbound message it answers.
    #[schemars(required)]
    pub in_reply_to_sms_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&SmsRecord> for SmsMessage {
    fn from(sms: &SmsRecord) -> Self {
        Self {
            id: sms.sms_id.clone(),
            provider_id: sms.provider_id.clone(),
            direction: sms.direction.clone(),
            channel: sms.channel.clone(),
            api: sms.api.clone(),
            from_number: sms.from_number.clone(),
            to_number: sms.to_number.clone(),
            body: sms.body.clone(),
            encoding: sms.encoding.clone(),
            segments: sms.segments,
            media: sms
                .media
                .iter()
                .map(|media| to_media_view(&sms.sms_id, media))
                .collect(),
            status: sms.status.clone(),
            error_code: sms.error_code.clone(),
            status_callback_url: sms.status_callback_url.clone(),
            messaging_service_sid: sms.messaging_service_sid.clone(),
            account: sms.account.clone(),
            extracted: ExtractedData {
                otp: sms.otp_codes.clone(),
                links: sms.links.clone(),
            },
            opened_at: sms.opened_at_unix_ms.map(format_rfc3339),
            open_count: sms.open_count,
            reply_webhook: None,
            in_reply_to_sms_id: sms.in_reply_to_sms_id.clone(),
            created_at: format_rfc3339(sms.created_at_unix_ms),
            updated_at: format_rfc3339(sms.updated_at_unix_ms),
        }
    }
}

fn to_media_view(sms_id: &str, media: &SmsMediaRecord) -> SmsMediaView {
    SmsMediaView {
        media_index: media.media_index,
        content_type: media.content_type.clone(),
        size_bytes: Some(media.size_bytes),
        filename: media.filename.clone(),
        source_url: media.source_url.clone(),
        url: format!("/api/v1/sms/{sms_id}/media/{}", media.media_index),
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SmsStatusChange {
    pub status: String,
    pub at: String,
    #[schemars(required)]
    pub error_code: Option<String>,
}

impl From<SmsStatusChangeRecord> for SmsStatusChange {
    fn from(status_change: SmsStatusChangeRecord) -> Self {
        Self {
            status: status_change.status,
            at: format_rfc3339(status_change.at_unix_ms),
            error_code: status_change.error_code,
        }
    }
}

/// One call to the message's status callback URL, in the provider's format.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SmsCallbackAttempt {
    pub id: String,
    pub reported_status: String,
    pub attempt: u32,
    pub request: RecordedHttpRequest,
    #[schemars(required)]
    pub response: Option<RecordedHttpResponse>,
    #[schemars(required)]
    pub duration_ms: Option<u64>,
    #[schemars(required)]
    pub error_message: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, serde::Deserialize, JsonSchema)]
pub struct RecordedHttpRequest {
    pub method: String,
    pub url: String,
    pub headers: BTreeMap<String, String>,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, serde::Deserialize, JsonSchema)]
pub struct RecordedHttpResponse {
    pub status_code: u16,
    pub headers: BTreeMap<String, String>,
    pub body: String,
    pub is_body_truncated: bool,
}

impl From<SmsCallbackAttemptRecord> for SmsCallbackAttempt {
    fn from(callback_attempt: SmsCallbackAttemptRecord) -> Self {
        Self {
            id: callback_attempt.attempt_id,
            reported_status: callback_attempt.reported_status,
            attempt: callback_attempt.attempt,
            request: serde_json::from_str(&callback_attempt.request_json).unwrap_or_else(|_| {
                RecordedHttpRequest {
                    method: "POST".to_owned(),
                    url: String::new(),
                    headers: BTreeMap::new(),
                    body: String::new(),
                }
            }),
            response: callback_attempt
                .response_json
                .and_then(|response_json| serde_json::from_str(&response_json).ok()),
            duration_ms: callback_attempt.duration_ms,
            error_message: callback_attempt.error_message,
            created_at: format_rfc3339(callback_attempt.created_at_unix_ms),
        }
    }
}

/// A conversation between two numbers.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SmsThread {
    pub thread_id: String,
    pub app_number: String,
    pub contact_number: String,
    pub channel: String,
    pub last_message: SmsMessage,
    pub message_count: u64,
    pub unread_count: u64,
}

impl From<SmsThreadRecord> for SmsThread {
    fn from(thread: SmsThreadRecord) -> Self {
        Self {
            thread_id: thread.last_message.thread_id.clone(),
            app_number: thread.last_message.app_number.clone(),
            contact_number: thread.last_message.contact_number.clone(),
            channel: thread.last_message.channel.clone(),
            last_message: SmsMessage::from(&thread.last_message),
            message_count: thread.message_count,
            unread_count: thread.unread_count,
        }
    }
}
