use std::collections::{BTreeMap, VecDeque};
use std::future::Future;
use std::pin::Pin;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use sendmock_ops::{
    RecordedHttpRequest, RecordedHttpResponse, WebhookSendFailure, WebhookSendResult, WebhookSender,
};

/// What the fake app does with one request.
#[derive(Debug, Clone, Copy)]
pub enum ScriptedAnswer {
    Status(u16),
    TimedOut,
    ConnectionRefused,
}

/// Answers webhook requests from a script (then 200), records them and the most requests it
/// ever had in flight at once.
#[derive(Default)]
pub struct ScriptedWebhookSender {
    scripted_answers: Mutex<VecDeque<ScriptedAnswer>>,
    received_requests: Mutex<Vec<RecordedHttpRequest>>,
    in_flight_count: AtomicUsize,
    most_in_flight: AtomicUsize,
    answer_delay: Duration,
}

impl ScriptedWebhookSender {
    pub fn answering(scripted_answers: &[ScriptedAnswer]) -> Self {
        Self {
            scripted_answers: Mutex::new(scripted_answers.iter().copied().collect()),
            ..Self::default()
        }
    }

    /// Holds every request this long, so concurrent sends overlap.
    pub fn answering_slowly(answer_delay: Duration) -> Self {
        Self {
            answer_delay,
            ..Self::default()
        }
    }

    pub fn received_requests(&self) -> Vec<RecordedHttpRequest> {
        self.received_requests
            .lock()
            .map(|received_requests| received_requests.clone())
            .unwrap_or_default()
    }

    pub fn most_in_flight(&self) -> usize {
        self.most_in_flight.load(Ordering::SeqCst)
    }

    async fn answer(&self, webhook_request: &RecordedHttpRequest) -> WebhookSendResult {
        let in_flight_now = self.in_flight_count.fetch_add(1, Ordering::SeqCst) + 1;
        self.most_in_flight
            .fetch_max(in_flight_now, Ordering::SeqCst);
        if let Ok(mut received_requests) = self.received_requests.lock() {
            received_requests.push(webhook_request.clone());
        }
        tokio::time::sleep(self.answer_delay).await;
        let scripted_answer = self
            .scripted_answers
            .lock()
            .ok()
            .and_then(|mut scripted_answers| scripted_answers.pop_front())
            .unwrap_or(ScriptedAnswer::Status(200));
        self.in_flight_count.fetch_sub(1, Ordering::SeqCst);
        match scripted_answer {
            ScriptedAnswer::Status(status_code) => WebhookSendResult {
                response: Some(RecordedHttpResponse {
                    status_code,
                    headers: BTreeMap::new(),
                    body: String::new(),
                    is_body_truncated: false,
                }),
                failure: None,
                error_message: None,
                duration_ms: 3,
            },
            ScriptedAnswer::TimedOut => WebhookSendResult {
                response: None,
                failure: Some(WebhookSendFailure::TimedOut),
                error_message: Some("Timed out after 10000 ms".to_owned()),
                duration_ms: 10_000,
            },
            ScriptedAnswer::ConnectionRefused => WebhookSendResult {
                response: None,
                failure: Some(WebhookSendFailure::ConnectionFailed),
                error_message: Some("Connection refused".to_owned()),
                duration_ms: 1,
            },
        }
    }
}

impl WebhookSender for ScriptedWebhookSender {
    fn send_webhook<'sender>(
        &'sender self,
        webhook_request: &'sender RecordedHttpRequest,
        _timeout_ms: u32,
    ) -> Pin<Box<dyn Future<Output = WebhookSendResult> + Send + 'sender>> {
        Box::pin(self.answer(webhook_request))
    }
}
