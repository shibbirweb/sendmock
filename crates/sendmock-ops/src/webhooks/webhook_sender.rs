use std::future::Future;
use std::pin::Pin;

use crate::{RecordedHttpRequest, RecordedHttpResponse};

/// Why an attempt got no answer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WebhookSendFailure {
    TimedOut,
    ConnectionFailed,
}

/// What came back from your app, or why nothing did.
#[derive(Debug, Clone, PartialEq)]
pub struct WebhookSendResult {
    pub response: Option<RecordedHttpResponse>,
    pub failure: Option<WebhookSendFailure>,
    pub error_message: Option<String>,
    pub duration_ms: u64,
}

/// Sends a signed webhook request; the binary provides the HTTP one, tests a recording one.
pub trait WebhookSender: Send + Sync {
    fn send_webhook<'sender>(
        &'sender self,
        webhook_request: &'sender RecordedHttpRequest,
        timeout_ms: u32,
    ) -> Pin<Box<dyn Future<Output = WebhookSendResult> + Send + 'sender>>;
}
