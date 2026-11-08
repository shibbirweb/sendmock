use std::future::Future;
use std::pin::Pin;
use std::time::{Duration, Instant};

use sendmock_ops::{HttpCallResult, RecordedHttpRequest, ReplyWebhookSender, StatusCallbackSender};

use crate::http_response_recording::record_response;

/// How long a status callback may take before it counts as a timeout.
pub const STATUS_CALLBACK_TIMEOUT: Duration = Duration::from_secs(10);

/// Twilio waits 15 seconds for a reply webhook to answer.
pub const REPLY_WEBHOOK_TIMEOUT: Duration = Duration::from_secs(15);

/// Calls your app over HTTP or HTTPS as a provider would: status callbacks and reply webhooks,
/// with the request's own method, headers and body, and no redirects followed.
pub struct HttpCallSender {
    http_client: reqwest::Client,
}

impl HttpCallSender {
    /// `None` when no HTTP client can be built; calls are then recorded as not sent.
    pub fn new(timeout: Duration) -> Option<Self> {
        let http_client = reqwest::Client::builder()
            .timeout(timeout)
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .ok()?;
        Some(Self { http_client })
    }

    async fn send(&self, recorded_request: &RecordedHttpRequest) -> HttpCallResult {
        let started_at = Instant::now();
        let method = reqwest::Method::from_bytes(recorded_request.method.as_bytes())
            .unwrap_or(reqwest::Method::POST);
        let mut request_builder = self
            .http_client
            .request(method, &recorded_request.url)
            .body(recorded_request.body.clone());
        for (header_name, header_value) in &recorded_request.headers {
            request_builder = request_builder.header(header_name, header_value);
        }
        let outcome = match request_builder.send().await {
            Ok(response) => Ok(record_response(response).await),
            Err(request_error) => Err((
                request_error.to_string(),
                is_connection_failure(&request_error),
            )),
        };
        let duration_ms = u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX);
        match outcome {
            Ok(recorded_response) => HttpCallResult {
                error_message: (recorded_response.status_code >= 400)
                    .then(|| format!("Your handler answered {}", recorded_response.status_code)),
                response: Some(recorded_response),
                is_connection_failure: false,
                duration_ms,
            },
            Err((error_message, is_connection_failure)) => HttpCallResult {
                response: None,
                error_message: Some(error_message),
                is_connection_failure,
                duration_ms,
            },
        }
    }
}

/// A connection that could not be opened (refused, unreachable, unknown host) or was reset or
/// aborted while waiting for the answer; a timeout is not one.
fn is_connection_failure(request_error: &reqwest::Error) -> bool {
    if request_error.is_timeout() {
        return false;
    }
    if request_error.is_connect() {
        return true;
    }
    let mut error_source: Option<&(dyn std::error::Error + 'static)> =
        std::error::Error::source(request_error);
    while let Some(source_error) = error_source {
        if let Some(io_error) = source_error.downcast_ref::<std::io::Error>() {
            return matches!(
                io_error.kind(),
                std::io::ErrorKind::ConnectionRefused
                    | std::io::ErrorKind::ConnectionReset
                    | std::io::ErrorKind::ConnectionAborted
                    | std::io::ErrorKind::BrokenPipe
            );
        }
        error_source = source_error.source();
    }
    false
}

impl StatusCallbackSender for HttpCallSender {
    fn send_status_callback<'sender>(
        &'sender self,
        callback_request: &'sender RecordedHttpRequest,
    ) -> Pin<Box<dyn Future<Output = HttpCallResult> + Send + 'sender>> {
        Box::pin(self.send(callback_request))
    }
}

impl ReplyWebhookSender for HttpCallSender {
    fn send_reply_webhook<'sender>(
        &'sender self,
        webhook_request: &'sender RecordedHttpRequest,
    ) -> Pin<Box<dyn Future<Output = HttpCallResult> + Send + 'sender>> {
        Box::pin(self.send(webhook_request))
    }
}
