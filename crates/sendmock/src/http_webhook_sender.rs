use std::collections::BTreeMap;
use std::future::Future;
use std::pin::Pin;
use std::time::{Duration, Instant};

use sendmock_ops::{RecordedHttpRequest, WebhookSendFailure, WebhookSendResult, WebhookSender};
use sendmock_webhooks::{FetchedFile, assemble_multipart_bytes, list_file_urls};

use crate::http_response_recording::record_response;

/// A file field's URL gets this long to answer.
const FILE_FETCH_TIMEOUT: Duration = Duration::from_secs(30);
/// Larger files are left out rather than held in memory.
const MAXIMUM_FILE_BYTES: usize = 25 * 1024 * 1024;

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

    /// The body as sent: a multipart body's file placeholders become the files their URLs
    /// answer, fetched now, so every attempt sends the current file (WH-07.16).
    async fn read_body_bytes(&self, webhook_request: &RecordedHttpRequest) -> Vec<u8> {
        let file_urls = list_file_urls(&webhook_request.body);
        if file_urls.is_empty() {
            return webhook_request.body.clone().into_bytes();
        }
        let mut fetched_files: BTreeMap<String, FetchedFile> = BTreeMap::new();
        for file_url in file_urls {
            if let Some(fetched_file) = self.fetch_file(&file_url).await {
                fetched_files.insert(file_url, fetched_file);
            }
        }
        assemble_multipart_bytes(&webhook_request.body, &|file_url| {
            fetched_files.get(file_url).cloned()
        })
    }

    async fn fetch_file(&self, file_url: &str) -> Option<FetchedFile> {
        let response = self
            .http_client
            .get(file_url)
            .timeout(FILE_FETCH_TIMEOUT)
            .send()
            .await
            .ok()?
            .error_for_status()
            .ok()?;
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|content_type| content_type.to_str().ok())
            .map(str::to_owned);
        let content = response.bytes().await.ok()?;
        (content.len() <= MAXIMUM_FILE_BYTES).then(|| FetchedFile {
            content_type,
            content: content.to_vec(),
        })
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
            .body(self.read_body_bytes(webhook_request).await);
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
