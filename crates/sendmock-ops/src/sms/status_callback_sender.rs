use std::future::Future;
use std::pin::Pin;

use super::sms_views::{RecordedHttpRequest, RecordedHttpResponse};

/// What came back from a status callback URL, or why nothing did.
#[derive(Debug, Clone, PartialEq)]
pub struct StatusCallbackResult {
    pub response: Option<RecordedHttpResponse>,
    pub error_message: Option<String>,
    pub duration_ms: u64,
}

/// Sends a rendered status callback; the binary provides the HTTP one.
pub trait StatusCallbackSender: Send + Sync {
    fn send_status_callback<'sender>(
        &'sender self,
        callback_request: &'sender RecordedHttpRequest,
    ) -> Pin<Box<dyn Future<Output = StatusCallbackResult> + Send + 'sender>>;
}
