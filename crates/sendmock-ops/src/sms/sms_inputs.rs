use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::{Map, Value};

/// An inline file in `media` of a native or simulated inbound send.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct InlineSmsMedia {
    /// The file name, e.g. `photo.jpg`.
    pub filename: Option<String>,
    /// The file bytes, base64 encoded.
    pub content: String,
    /// Guessed from the file extension when missing.
    pub content_type: Option<String>,
}

/// Body of POST /api/v1/sms (native send).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct NativeSmsRequest {
    /// The sender: an E.164 number or an alphanumeric sender ID.
    pub from: String,
    /// The recipient, an E.164 number; `whatsapp:+...` sends over WhatsApp.
    pub to: String,
    /// The message text. Its length and characters decide the segments and the encoding (GSM-7 or UCS-2).
    pub body: String,
    /// Your app's URL that receives each status change (queued, sent, delivered, failed).
    pub status_callback: Option<String>,
    /// Any JSON you want stored with the message and echoed in its events.
    pub metadata: Option<Map<String, Value>>,
    /// Public links SendMock downloads, like Twilio's `MediaUrl`.
    pub media_urls: Option<Vec<String>>,
    /// Files sent inline as MMS media, base64 encoded.
    pub media: Option<Vec<InlineSmsMedia>>,
}

/// Body of POST /api/v1/sms/inbound (simulate an incoming message).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct InboundSmsRequest {
    /// Who texts your app: the user's number.
    pub from: String,
    /// Your app's number that receives it, usually a virtual number.
    pub to: String,
    /// The message text.
    pub body: String,
    /// `sms` (default) or `whatsapp`.
    pub channel: Option<String>,
    /// The payload template for the inbound webhook, instead of the number's (e.g. `twilio.inbound_sms`).
    pub template_id: Option<String>,
    /// Files sent with the message, as MMS or WhatsApp media.
    pub media: Option<Vec<InlineSmsMedia>>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SmsReference {
    /// The SMS's ID, from `GET /api/v1/sms`.
    pub sms_id: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SmsMediaReference {
    /// The SMS's ID, from `GET /api/v1/sms`.
    pub sms_id: String,
    /// Position of the media file in the SMS's `media`, starting at 0.
    pub media_index: u32,
}

/// Body of `POST /sms/{smsId}/status`: a manual status change.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SmsStatusUpdate {
    /// The SMS's ID, from `GET /api/v1/sms`.
    pub sms_id: String,
    /// The new status; fires the status callback and the matching event.
    pub status: String,
    /// A Twilio error code for `failed` or `undelivered`, e.g. `30003` (unreachable).
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct SmsListInput {
    /// The next_cursor of the previous page.
    pub cursor: Option<String>,
    /// Items per page, 1 to 200 (default 50).
    pub limit: Option<u32>,
    /// Number or text.
    pub query: Option<String>,
    /// Sender number.
    pub from: Option<String>,
    /// Recipient number.
    pub to: Option<String>,
    /// Delivery status.
    pub status: Option<String>,
    /// Outbound from your app or inbound to it.
    pub direction: Option<String>,
    /// Only this conversation.
    pub thread_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WaitSmsInput {
    /// The recipient number.
    pub to: Option<String>,
    /// The sender number.
    pub from: Option<String>,
    /// Only match items newer than this time (default: 30 s ago).
    pub since: Option<String>,
    /// How long to wait, e.g. 10s (default 10s, at most 60s).
    pub timeout: Option<String>,
}
