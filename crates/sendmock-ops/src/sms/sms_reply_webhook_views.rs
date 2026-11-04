use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_sms::{TwimlMethod, TwimlVerb};
use sendmock_store::SmsReplyWebhookAttemptRecord;
use serde::{Deserialize, Serialize};

use super::sms_views::{RecordedHttpRequest, RecordedHttpResponse};

/// Who configured the URL the reply webhook went to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReplyWebhookTargetName {
    /// A Messaging Service set to "Send a webhook".
    MessagingService,
    /// The number's own URL.
    Number,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReplyWebhookOutcome {
    Succeeded,
    Failed,
}

/// The outcome of an inbound message's reply webhook, for the bubble.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct SmsReplyWebhookResult {
    pub target: ReplyWebhookTargetName,
    pub outcome: ReplyWebhookOutcome,
    /// Of the last attempt.
    #[schemars(required, schema_with = "crate::nullable_schema::<u16>")]
    pub status_code: Option<u16>,
    /// Twilio's code for the primary URL's failure, e.g. "11205".
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub error_code: Option<String>,
    /// The primary failed and the fallback URL answered.
    pub used_fallback: bool,
    /// Messages created from the TwiML.
    pub reply_count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum TwimlMethodName {
    #[serde(rename = "GET")]
    Get,
    #[serde(rename = "POST")]
    Post,
}

impl From<TwimlMethod> for TwimlMethodName {
    fn from(twiml_method: TwimlMethod) -> Self {
        match twiml_method {
            TwimlMethod::Get => Self::Get,
            TwimlMethod::Post => Self::Post,
        }
    }
}

/// A verb of the TwiML an app answered with.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "verb")]
pub enum TwimlVerbView {
    Message {
        body: String,
        #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
        to: Option<String>,
        #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
        from: Option<String>,
        #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
        status_callback: Option<String>,
        /// Requested once the reply is sent, with `method`.
        #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
        action: Option<String>,
        method: TwimlMethodName,
        media_urls: Vec<String>,
    },
    Redirect {
        url: String,
        method: TwimlMethodName,
    },
}

impl From<&TwimlVerb> for TwimlVerbView {
    fn from(twiml_verb: &TwimlVerb) -> Self {
        match twiml_verb {
            TwimlVerb::Message(twiml_message) => Self::Message {
                body: twiml_message.body.clone(),
                to: twiml_message.to.clone(),
                from: twiml_message.from.clone(),
                status_callback: twiml_message.status_callback.clone(),
                action: twiml_message.action.clone(),
                method: twiml_message.method.into(),
                media_urls: twiml_message.media_urls.clone(),
            },
            TwimlVerb::Redirect(twiml_redirect) => Self::Redirect {
                url: twiml_redirect.url.clone(),
                method: twiml_redirect.method.into(),
            },
        }
    }
}

/// One call to a reply webhook URL, primary or fallback.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct SmsReplyWebhookAttempt {
    pub id: String,
    pub is_fallback: bool,
    pub request: RecordedHttpRequest,
    #[schemars(
        required,
        schema_with = "crate::nullable_schema::<RecordedHttpResponse>"
    )]
    pub response: Option<RecordedHttpResponse>,
    #[schemars(required, schema_with = "crate::nullable_schema::<u64>")]
    pub duration_ms: Option<u64>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub error_code: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub error_message: Option<String>,
    pub twiml: Vec<TwimlVerbView>,
    pub created_at: String,
}

impl From<SmsReplyWebhookAttemptRecord> for SmsReplyWebhookAttempt {
    fn from(reply_webhook_attempt: SmsReplyWebhookAttemptRecord) -> Self {
        Self {
            id: reply_webhook_attempt.attempt_id,
            is_fallback: reply_webhook_attempt.is_fallback,
            request: serde_json::from_str(&reply_webhook_attempt.request_json)
                .unwrap_or_else(|_| RecordedHttpRequest::empty_post()),
            response: reply_webhook_attempt
                .response_json
                .and_then(|response_json| serde_json::from_str(&response_json).ok()),
            duration_ms: reply_webhook_attempt.duration_ms,
            error_code: reply_webhook_attempt.error_code,
            error_message: reply_webhook_attempt.error_message,
            twiml: serde_json::from_str(&reply_webhook_attempt.twiml_json).unwrap_or_default(),
            created_at: format_rfc3339(reply_webhook_attempt.created_at_unix_ms),
        }
    }
}
