use std::future::Future;
use std::pin::Pin;
use std::time::{Duration, Instant};

use sendmock_ops::{RecordedHttpRequest, WebhookSendFailure, WebhookSendResult, WebhookSender};

use crate::http_response_recording::record_response;

/// Sends webhook deliveries over HTTP or HTTPS, with each endpoint's own timeout.
pub struct HttpWebhookSender {
    http_client: reqwest::Client,
}

impl HttpWebhookSender {
    /// `None` when no HTTP client can be built; attempts then fail as not sent.
    pub fn new() -> Option<Self> {
        let http_client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .ok()?;
        Some(Self { http_client })
    }

    async fn send(
        &self,
        webhook_request: &RecordedHttpRequest,
        timeout_ms: u32,
    ) -> WebhookSendResult {
        let started_at = Instant::now();
        let Ok(method) = reqwest::Method::from_bytes(webhook_request.method.as_bytes()) else {
            return WebhookSendResult {
                response: None,
                failure: Some(WebhookSendFailure::ConnectionFailed),
                error_message: Some(format!("{} is not an HTTP method", webhook_request.method)),
                duration_ms: 0,
            };
        };
        let mut request_builder = self
            .http_client
            .request(method, &webhook_request.url)
            .timeout(Duration::from_millis(u64::from(timeout_ms)))
            .body(webhook_request.body.clone());
        for (header_name, header_value) in &webhook_request.headers {
            request_builder = request_builder.header(header_name, header_value);
        }
        let send_outcome = match request_builder.send().await {
            Ok(response) => Ok(record_response(response).await),
            Err(request_error) => Err(request_error),
        };
        let duration_ms = u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX);
        match send_outcome {
            Ok(recorded_response) => WebhookSendResult {
                response: Some(recorded_response),
                failure: None,
                error_message: None,
                duration_ms,
            },
            Err(request_error) => WebhookSendResult {
                response: None,
                failure: Some(if request_error.is_timeout() {
                    WebhookSendFailure::TimedOut
                } else {
                    WebhookSendFailure::ConnectionFailed
                }),
                error_message: Some(if request_error.is_timeout() {
                    format!("Timed out after {timeout_ms} ms")
                } else {
                    request_error.to_string()
                }),
                duration_ms,
            },
        }
    }
}

impl WebhookSender for HttpWebhookSender {
    fn send_webhook<'sender>(
        &'sender self,
        webhook_request: &'sender RecordedHttpRequest,
        timeout_ms: u32,
    ) -> Pin<Box<dyn Future<Output = WebhookSendResult> + Send + 'sender>> {
        Box::pin(self.send(webhook_request, timeout_ms))
    }
}
