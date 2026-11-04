/// One call an inbound message made to your app; request, response and TwiML are JSON documents.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmsReplyWebhookAttemptRecord {
    pub attempt_id: String,
    pub sms_id: String,
    /// Sent to the fallback URL after the reply webhook failed.
    pub is_fallback: bool,
    pub request_json: String,
    pub response_json: Option<String>,
    pub duration_ms: Option<u64>,
    /// Twilio's code for what went wrong, such as `11200`.
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    /// The TwiML verbs read from the answer, as a JSON array.
    pub twiml_json: String,
    pub created_at_unix_ms: i64,
}
