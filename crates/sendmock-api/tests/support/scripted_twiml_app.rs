use std::collections::BTreeMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Mutex;
use std::time::Duration;

use sendmock_ops::{
    FetchedMedia, HttpCallResult, MediaFetcher, RecordedHttpRequest, RecordedHttpResponse,
    ReplyWebhookSender,
};

/// One scripted answer of the app: status, content type and body.
#[derive(Debug, Clone)]
pub struct TwimlAppAnswer {
    pub status_code: u16,
    pub content_type: String,
    pub body: String,
}

/// Your app as the reply webhook sees it: answers each URL (without its query) with its
/// scripted TwiML, or an empty `<Response/>`, records every request, and serves the media files
/// its TwiML links to.
#[derive(Default)]
pub struct ScriptedTwimlApp {
    answers_by_url: BTreeMap<String, TwimlAppAnswer>,
    received_requests: Mutex<Vec<RecordedHttpRequest>>,
}

impl ScriptedTwimlApp {
    /// Answers `url` with this TwiML as `text/xml`.
    #[must_use]
    pub fn answering_twiml(self, url: &str, twiml: &str) -> Self {
        self.answering(
            url,
            TwimlAppAnswer {
                status_code: 200,
                content_type: "text/xml".to_owned(),
                body: twiml.to_owned(),
            },
        )
    }

    #[must_use]
    pub fn answering(mut self, url: &str, answer: TwimlAppAnswer) -> Self {
        self.answers_by_url.insert(url.to_owned(), answer);
        self
    }

    pub fn received_requests(&self) -> Vec<RecordedHttpRequest> {
        self.received_requests
            .lock()
            .map(|received_requests| received_requests.clone())
            .unwrap_or_default()
    }

    /// Polls until `count` requests arrived, as the reply webhook runs in the background.
    pub async fn wait_for_requests(&self, count: usize) -> Vec<RecordedHttpRequest> {
        for _ in 0..200 {
            if self.received_requests().len() >= count {
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
        self.received_requests()
    }

    fn answer_for(&self, request_url: &str) -> TwimlAppAnswer {
        let url_without_query = request_url.split('?').next().unwrap_or(request_url);
        self.answers_by_url
            .get(url_without_query)
            .cloned()
            .unwrap_or_else(|| TwimlAppAnswer {
                status_code: 200,
                content_type: "text/xml".to_owned(),
                body: "<Response/>".to_owned(),
            })
    }
}

impl ReplyWebhookSender for ScriptedTwimlApp {
    fn send_reply_webhook<'sender>(
        &'sender self,
        webhook_request: &'sender RecordedHttpRequest,
    ) -> Pin<Box<dyn Future<Output = HttpCallResult> + Send + 'sender>> {
        Box::pin(async move {
            if let Ok(mut received_requests) = self.received_requests.lock() {
                received_requests.push(webhook_request.clone());
            }
            let answer = self.answer_for(&webhook_request.url);
            HttpCallResult {
                response: Some(RecordedHttpResponse {
                    status_code: answer.status_code,
                    headers: BTreeMap::from([("content-type".to_owned(), answer.content_type)]),
                    body: answer.body,
                    is_body_truncated: false,
                }),
                error_message: None,
                duration_ms: 4,
            }
        })
    }
}

impl MediaFetcher for ScriptedTwimlApp {
    fn fetch_media<'fetcher>(
        &'fetcher self,
        _media_url: &'fetcher str,
        _maximum_bytes: usize,
    ) -> Pin<Box<dyn Future<Output = Result<FetchedMedia, String>> + Send + 'fetcher>> {
        Box::pin(async move {
            Ok(FetchedMedia {
                content_type: Some("image/png".to_owned()),
                bytes: vec![137, 80, 78, 71],
            })
        })
    }
}
