use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// The events SendMock publishes so far; webhook rules use the same names.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppEventType {
    EmailReceived,
    EmailInbound,
    EmailDelivered,
    EmailDeferred,
    EmailBounced,
    EmailComplained,
    EmailOpened,
    EmailUnsubscribed,
    EmailDeleted,
    SmsSent,
    SmsInbound,
    SmsStatus,
    SmsOpened,
    /// An inbound message's reply webhook finished; drives the live conversation only.
    SmsReplyWebhook,
    VerifyStarted,
    VerifyChecked,
    VerifyExpired,
    WebhookDelivered,
    WebhookFailed,
    PaymentCreated,
    PaymentSucceeded,
    PaymentFailed,
    PaymentCanceled,
    PaymentRefunded,
    PaymentPartiallyRefunded,
    PaymentDisputeOpened,
    PaymentDisputeClosed,
    CheckoutCompleted,
    CheckoutExpired,
}

impl AppEventType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::EmailReceived => "email.received",
            Self::EmailInbound => "email.inbound",
            Self::EmailDelivered => "email.delivered",
            Self::EmailDeferred => "email.deferred",
            Self::EmailBounced => "email.bounced",
            Self::EmailComplained => "email.complained",
            Self::EmailOpened => "email.opened",
            Self::EmailUnsubscribed => "email.unsubscribed",
            Self::EmailDeleted => "email.deleted",
            Self::SmsSent => "sms.sent",
            Self::SmsInbound => "sms.inbound",
            Self::SmsStatus => "sms.status",
            Self::SmsOpened => "sms.opened",
            Self::SmsReplyWebhook => "sms.reply_webhook",
            Self::VerifyStarted => "verify.started",
            Self::VerifyChecked => "verify.checked",
            Self::VerifyExpired => "verify.expired",
            Self::WebhookDelivered => "webhook.delivered",
            Self::WebhookFailed => "webhook.failed",
            Self::PaymentCreated => "payment.created",
            Self::PaymentSucceeded => "payment.succeeded",
            Self::PaymentFailed => "payment.failed",
            Self::PaymentCanceled => "payment.canceled",
            Self::PaymentRefunded => "payment.refunded",
            Self::PaymentPartiallyRefunded => "payment.partially_refunded",
            Self::PaymentDisputeOpened => "payment.dispute_opened",
            Self::PaymentDisputeClosed => "payment.dispute_closed",
            Self::CheckoutCompleted => "checkout.completed",
            Self::CheckoutExpired => "checkout.expired",
        }
    }
}

/// The envelope pushed over the realtime streams and sent in native webhooks.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct AppEvent {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub created_at: String,
    /// Trimmed to list-view fields of the subject (email, SMS, delivery, ...).
    pub data: Value,
}

/// An event as the bus keeps it: `sequence` orders events and lets a reconnecting
/// client skip what it already has.
#[derive(Debug, Clone, PartialEq)]
pub struct RecordedEvent {
    pub sequence: u64,
    pub created_at_unix_ms: i64,
    pub app_event: AppEvent,
}
