use super::sms_views::RecordedHttpResponse;

/// What came back from a call to your app (a status callback or a reply webhook), or why
/// nothing did.
#[derive(Debug, Clone, PartialEq)]
pub struct HttpCallResult {
    pub response: Option<RecordedHttpResponse>,
    pub error_message: Option<String>,
    /// No answer because the connection was refused, reset or could not be opened, which
    /// Twilio reports as 11205 rather than 11200.
    pub is_connection_failure: bool,
    pub duration_ms: u64,
}
