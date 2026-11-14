use std::collections::BTreeMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Mutex;
use std::time::Duration;

use sendmock_ops::{
    FetchedMedia, HttpCallResult, MediaFetcher, RecordedHttpRequest, RecordedHttpResponse,
    ReplyWebhookSender,
};

/// One scripted answer of the app: status, content type and body, or a connection that fails.
#[derive(Debug, Clone)]
pub struct TwimlAppAnswer {
    pub status_code: u16,
    pub content_type: String,
    pub body: String,
}

/// How the app answers one URL.
#[derive(Debug, Clone)]
enum ScriptedAnswer {
    Answer(TwimlAppAnswer),
    /// No answer: refused (a connection failure) or timed out.
    NoAnswer {
        is_connection_failure: bool,
    },
}

/// Your app as the reply webhook sees it: answers each URL (without its query) with its
/// scripted TwiML, or an empty `<Response/>`, records every request, and serves the media files
/// its TwiML links to.
#[derive(Default)]
pub struct ScriptedTwimlApp {
    answers_by_url: Mutex<BTreeMap<String, ScriptedAnswer>>,
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
    pub fn answering(self, url: &str, answer: TwimlAppAnswer) -> Self {
        self.script(url, ScriptedAnswer::Answer(answer));
        self
    }

    /// From now on `url` answers this TwiML, as when you fix your handler.
    pub fn answer_twiml_from_now_on(&self, url: &str, twiml: &str) {
        self.script(
            url,
            ScriptedAnswer::Answer(TwimlAppAnswer {
                status_code: 200,
                content_type: "text/xml".to_owned(),
                body: twiml.to_owned(),
            }),
        );
    }

    fn script(&self, url: &str, scripted_answer: ScriptedAnswer) {
        if let Ok(mut answers_by_url) = self.answers_by_url.lock() {
            answers_by_url.insert(url.to_owned(), scripted_answer);
        }
    }

    /// `url` refuses the connection.
    #[must_use]
    pub fn refusing(self, url: &str) -> Self {
        self.script(
            url,
            ScriptedAnswer::NoAnswer {
                is_connection_failure: true,
            },
        );
        self
    }

    /// `url` gives no answer within the timeout.
    #[must_use]
    pub fn timing_out(self, url: &str) -> Self {
        self.script(
            url,
            ScriptedAnswer::NoAnswer {
                is_connection_failure: false,
            },
        );
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

    fn answer_for(&self, request_url: &str) -> ScriptedAnswer {
        let url_without_query = request_url.split('?').next().unwrap_or(request_url);
        self.answers_by_url
            .lock()
            .ok()
            .and_then(|answers_by_url| answers_by_url.get(url_without_query).cloned())
            .unwrap_or_else(|| {
                ScriptedAnswer::Answer(TwimlAppAnswer {
                    status_code: 200,
                    content_type: "text/xml".to_owned(),
                    body: "<Response/>".to_owned(),
                })
            })
    }
}

fn to_call_result(scripted_answer: ScriptedAnswer) -> HttpCallResult {
    match scripted_answer {
        ScriptedAnswer::Answer(answer) => HttpCallResult {
            response: Some(RecordedHttpResponse {
                status_code: answer.status_code,
                headers: BTreeMap::from([("content-type".to_owned(), answer.content_type)]),
                body: answer.body,
                is_body_truncated: false,
            }),
            error_message: None,
            is_connection_failure: false,
            duration_ms: 4,
        },
        ScriptedAnswer::NoAnswer {
            is_connection_failure,
        } => HttpCallResult {
            response: None,
            error_message: Some(if is_connection_failure {
                "connection refused".to_owned()
            } else {
                "operation timed out".to_owned()
            }),
            is_connection_failure,
            duration_ms: 15_000,
        },
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
            to_call_result(self.answer_for(&webhook_request.url))
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
