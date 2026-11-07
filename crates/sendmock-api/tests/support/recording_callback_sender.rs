use std::collections::{BTreeMap, VecDeque};
use std::future::Future;
use std::pin::Pin;
use std::sync::Mutex;
use std::time::Duration;

use sendmock_ops::{
    HttpCallResult, RecordedHttpRequest, RecordedHttpResponse, StatusCallbackSender,
};
use serde_json::Value;

/// Records every callback and answers 204, or the scripted answers in order, so tests see
/// what a handler would receive. A `None` answer is a refused connection.
#[derive(Default)]
pub struct RecordingCallbackSender {
    received_requests: Mutex<Vec<RecordedHttpRequest>>,
    scripted_answers: Mutex<VecDeque<Option<u16>>>,
}

fn answer_with(scripted_answer: Option<u16>) -> HttpCallResult {
    match scripted_answer {
        Some(status_code) => HttpCallResult {
            response: Some(RecordedHttpResponse {
                status_code,
                headers: BTreeMap::new(),
                body: String::new(),
                is_body_truncated: false,
            }),
            error_message: (status_code >= 400)
                .then(|| format!("Your handler answered {status_code}")),
            is_connection_failure: false,
            duration_ms: 3,
        },
        None => HttpCallResult {
            response: None,
            error_message: Some("connection refused".to_owned()),
            is_connection_failure: true,
            duration_ms: 1,
        },
    }
}

impl RecordingCallbackSender {
    /// Answers with these first, then 204 for every later callback.
    pub fn answering(scripted_answers: impl IntoIterator<Item = Option<u16>>) -> Self {
        Self {
            received_requests: Mutex::default(),
            scripted_answers: Mutex::new(scripted_answers.into_iter().collect()),
        }
    }

    pub fn received_statuses(&self) -> Vec<String> {
        self.received_requests
            .lock()
            .map(|received_requests| {
                received_requests
                    .iter()
                    .map(|callback_request| {
                        let callback_body: Value =
                            serde_json::from_str(&callback_request.body).unwrap_or(Value::Null);
                        callback_body["status"]
                            .as_str()
                            .unwrap_or_default()
                            .to_owned()
                    })
                    .collect()
            })
            .unwrap_or_default()
    }
}

impl StatusCallbackSender for RecordingCallbackSender {
    fn send_status_callback<'sender>(
        &'sender self,
        callback_request: &'sender RecordedHttpRequest,
    ) -> Pin<Box<dyn Future<Output = HttpCallResult> + Send + 'sender>> {
        Box::pin(async move {
            if let Ok(mut received_requests) = self.received_requests.lock() {
                received_requests.push(callback_request.clone());
            }
            let scripted_answer = self
                .scripted_answers
                .lock()
                .ok()
                .and_then(|mut scripted_answers| scripted_answers.pop_front())
                .unwrap_or(Some(204));
            answer_with(scripted_answer)
        })
    }
}

impl RecordingCallbackSender {
    pub fn received_requests(&self) -> Vec<RecordedHttpRequest> {
        self.received_requests
            .lock()
            .map(|received_requests| received_requests.clone())
            .unwrap_or_default()
    }

    /// Polls until `count` callbacks arrived, for callbacks sent in the background.
    pub async fn wait_for_requests(&self, count: usize) -> Vec<RecordedHttpRequest> {
        for _ in 0..60 {
            if self.received_requests().len() >= count {
                break;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        self.received_requests()
    }
}
