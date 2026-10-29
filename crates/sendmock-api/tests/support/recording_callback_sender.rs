use std::collections::BTreeMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Mutex;
use std::time::Duration;

use sendmock_ops::{
    RecordedHttpRequest, RecordedHttpResponse, StatusCallbackResult, StatusCallbackSender,
};
use serde_json::Value;

/// Records every callback and answers 204, so tests see what a handler would receive.
#[derive(Default)]
pub struct RecordingCallbackSender {
    received_requests: Mutex<Vec<RecordedHttpRequest>>,
}

impl RecordingCallbackSender {
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
    ) -> Pin<Box<dyn Future<Output = StatusCallbackResult> + Send + 'sender>> {
        Box::pin(async move {
            if let Ok(mut received_requests) = self.received_requests.lock() {
                received_requests.push(callback_request.clone());
            }
            StatusCallbackResult {
                response: Some(RecordedHttpResponse {
                    status_code: 204,
                    headers: BTreeMap::new(),
                    body: String::new(),
                    is_body_truncated: false,
                }),
                error_message: None,
                duration_ms: 3,
            }
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
