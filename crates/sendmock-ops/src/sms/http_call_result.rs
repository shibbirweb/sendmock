use super::sms_views::RecordedHttpResponse;

/// What came back from a call to your app (a status callback or a reply webhook), or why
/// nothing did.
#[derive(Debug, Clone, PartialEq)]
pub struct HttpCallResult {
    pub response: Option<RecordedHttpResponse>,
    pub error_message: Option<String>,
    pub duration_ms: u64,
}
