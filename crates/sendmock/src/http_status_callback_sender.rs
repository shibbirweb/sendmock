use std::future::Future;
use std::pin::Pin;
use std::time::{Duration, Instant};

use sendmock_ops::{RecordedHttpRequest, StatusCallbackResult, StatusCallbackSender};

use crate::http_response_recording::record_response;

const CALLBACK_TIMEOUT: Duration = Duration::from_secs(10);

/// Calls status callback URLs over HTTP or HTTPS, as the provider would.
pub struct HttpStatusCallbackSender {
    http_client: reqwest::Client,
}

impl HttpStatusCallbackSender {
    /// `None` when no HTTP client can be built; attempts are then recorded as not sent.
    pub fn new() -> Option<Self> {
        let http_client = reqwest::Client::builder()
            .timeout(CALLBACK_TIMEOUT)
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .ok()?;
        Some(Self { http_client })
    }

    async fn send(&self, callback_request: &RecordedHttpRequest) -> StatusCallbackResult {
        let started_at = Instant::now();
        let mut request_builder = self
            .http_client
            .post(&callback_request.url)
            .body(callback_request.body.clone());
        for (header_name, header_value) in &callback_request.headers {
            request_builder = request_builder.header(header_name, header_value);
        }
        let outcome = match request_builder.send().await {
            Ok(response) => Ok(record_response(response).await),
            Err(request_error) => Err(request_error.to_string()),
        };
        let duration_ms = u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX);
        match outcome {
            Ok(recorded_response) => StatusCallbackResult {
                error_message: (recorded_response.status_code >= 400)
                    .then(|| format!("Your handler answered {}", recorded_response.status_code)),
                response: Some(recorded_response),
                duration_ms,
            },
            Err(error_message) => StatusCallbackResult {
                response: None,
                error_message: Some(error_message),
                duration_ms,
            },
        }
    }
}

impl StatusCallbackSender for HttpStatusCallbackSender {
    fn send_status_callback<'sender>(
        &'sender self,
        callback_request: &'sender RecordedHttpRequest,
    ) -> Pin<Box<dyn Future<Output = StatusCallbackResult> + Send + 'sender>> {
        Box::pin(self.send(callback_request))
    }
}
