#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod recording_callback_sender;
    pub mod test_app;
}

use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::http::Request;
use sendmock_ops::{OperationContext, run_due_status_callbacks};
use sendmock_store::SmsCallbackAttemptRecord;
use serde_json::{Value, json};
use support::manual_clock::ManualClock;
use support::recording_callback_sender::RecordingCallbackSender;
use support::test_app::{build_test_app_with, call_api};
use tower::ServiceExt;

const START_UNIX_MS: i64 = 1_767_225_600_000;
const CALLBACK_URL: &str = "http://127.0.0.1:9/sms/status";
const MAX_CONCURRENT_CALLBACKS: u32 = 8;

struct CallbackFixture {
    app_router: axum::Router,
    operation_context: OperationContext,
    manual_clock: Arc<ManualClock>,
    callback_sender: Arc<RecordingCallbackSender>,
}

/// The `manual` profile moves a message to `sent` and holds it there, so each send makes two
/// callbacks, `queued` then `sent`, sent one after the other in that order.
async fn build_fixture(scripted_answers: Vec<Option<u16>>) -> CallbackFixture {
    let manual_clock = Arc::new(ManualClock::new(START_UNIX_MS));
    let callback_sender = Arc::new(RecordingCallbackSender::answering(scripted_answers));
    let (app_router, operation_context) = build_test_app_with(|mut operation_context| {
        operation_context.clock = manual_clock.clone();
        operation_context.with_status_callback_sender(callback_sender.clone())
    });
    let manual_profile = json!({ "sms_simulation_profile": "manual" });
    let (status, _) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&manual_profile),
    )
    .await;
    assert_eq!(status, 200);
    CallbackFixture {
        app_router,
        operation_context,
        manual_clock,
        callback_sender,
    }
}

impl CallbackFixture {
    async fn send_native_sms(&self) -> String {
        let sms_request = json!({
            "from": "+15550001111", "to": "+8801700000000", "body": "Hi",
            "status_callback": CALLBACK_URL,
        });
        let (status, sent_sms) =
            call_api(&self.app_router, "POST", "/api/v1/sms", Some(&sms_request)).await;
        assert_eq!(status, 201, "{sent_sms}");
        sent_sms["id"].as_str().unwrap_or_default().to_owned()
    }

    async fn send_twilio_sms(&self) -> String {
        let form_body = format!(
            "To=%2B8801700000000&From=%2B15005550006&Body=Hi&StatusCallback={}",
            CALLBACK_URL.replace(':', "%3A").replace('/', "%2F")
        );
        let request = Request::post(
            "/providers/twilio/2010-04-01/Accounts/AC11111111111111111111111111111111/Messages.json",
        )
        .header("content-type", "application/x-www-form-urlencoded")
        .body(Body::from(form_body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
        let response = self
            .app_router
            .clone()
            .oneshot(request)
            .await
            .unwrap_or_else(|error| panic!("a response: {error}"));
        assert_eq!(response.status().as_u16(), 201);
        let (_, sms_list) = call_api(&self.app_router, "GET", "/api/v1/sms", None).await;
        sms_list["items"][0]["id"]
            .as_str()
            .unwrap_or_default()
            .to_owned()
    }

    async fn read_callback_attempts(&self, sms_id: &str) -> Vec<Value> {
        let (_, sms_detail) = call_api(
            &self.app_router,
            "GET",
            &format!("/api/v1/sms/{sms_id}"),
            None,
        )
        .await;
        sms_detail["callback_attempts"]
            .as_array()
            .cloned()
            .unwrap_or_default()
    }

    /// Waits for the first attempt, which the delivery task sends in the background.
    async fn wait_for_callback_attempts(&self, sms_id: &str, count: usize) -> Vec<Value> {
        for _ in 0..60 {
            let callback_attempts = self.read_callback_attempts(sms_id).await;
            if callback_attempts.len() >= count {
                return callback_attempts;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        self.read_callback_attempts(sms_id).await
    }

    async fn read_callback_attempts_reporting(
        &self,
        sms_id: &str,
        reported_status: &str,
    ) -> Vec<Value> {
        self.read_callback_attempts(sms_id)
            .await
            .into_iter()
            .filter(|callback_attempt| callback_attempt["reported_status"] == reported_status)
            .collect()
    }

    /// Moves the clock and runs one pass of the retry queue; answers how many attempts ran.
    async fn run_retries_after_ms(&self, elapsed_ms: i64) -> usize {
        self.manual_clock.advance_ms(elapsed_ms);
        run_due_status_callbacks(&self.operation_context, MAX_CONCURRENT_CALLBACKS)
            .await
            .unwrap_or_else(|error| panic!("a retry pass: {error}"))
    }
}

// AC: SM-08.3
#[tokio::test]
async fn a_failed_callback_is_retried_with_the_same_signed_request() {
    let fixture = build_fixture(vec![Some(503)]).await;
    let sms_id = fixture.send_twilio_sms().await;
    fixture.wait_for_callback_attempts(&sms_id, 2).await;

    let early_attempt_count = fixture.run_retries_after_ms(999).await;
    let retry_attempt_count = fixture.run_retries_after_ms(1).await;

    let queued_attempts = fixture
        .read_callback_attempts_reporting(&sms_id, "queued")
        .await;
    assert_eq!(early_attempt_count, 0, "the first retry waits 1 second");
    assert_eq!(retry_attempt_count, 1);
    assert_eq!(queued_attempts.len(), 2);
    assert_eq!(
        queued_attempts[0]["error_message"],
        "Your handler answered 503"
    );
    assert_eq!(queued_attempts[1]["attempt"], 2);
    assert_eq!(queued_attempts[1]["response"]["status_code"], 204);
    assert_eq!(queued_attempts[1]["error_message"], Value::Null);
    let sent_requests = fixture.callback_sender.received_requests();
    assert_eq!(sent_requests.len(), 3);
    assert_eq!(sent_requests[2], sent_requests[0]);
    assert!(sent_requests[2].headers.contains_key("X-Twilio-Signature"));
}

// AC: SM-08.3
#[tokio::test]
async fn retries_follow_the_backoff_and_stop_after_five_attempts() {
    let fixture = build_fixture(vec![None, Some(204), None, None, None, None]).await;
    let sms_id = fixture.send_native_sms().await;
    fixture.wait_for_callback_attempts(&sms_id, 2).await;

    for backoff_ms in [1_000, 5_000, 30_000, 120_000] {
        assert_eq!(fixture.run_retries_after_ms(backoff_ms - 1).await, 0);
        assert_eq!(fixture.run_retries_after_ms(1).await, 1);
    }
    let attempts_after_the_last = fixture.run_retries_after_ms(3_600_000).await;

    let callback_attempts = fixture
        .read_callback_attempts_reporting(&sms_id, "queued")
        .await;
    assert_eq!(attempts_after_the_last, 0);
    assert_eq!(
        callback_attempts
            .iter()
            .map(|callback_attempt| callback_attempt["attempt"].clone())
            .collect::<Vec<_>>(),
        vec![json!(1), json!(2), json!(3), json!(4), json!(5)]
    );
    assert!(
        callback_attempts
            .iter()
            .all(|callback_attempt| callback_attempt["error_message"] == "connection refused")
    );
}

// AC: SM-08.3
#[tokio::test]
async fn a_client_error_answer_is_not_retried() {
    let fixture = build_fixture(vec![Some(404)]).await;
    let sms_id = fixture.send_native_sms().await;
    fixture.wait_for_callback_attempts(&sms_id, 2).await;

    let retry_attempt_count = fixture.run_retries_after_ms(3_600_000).await;

    let queued_attempts = fixture
        .read_callback_attempts_reporting(&sms_id, "queued")
        .await;
    assert_eq!(retry_attempt_count, 0);
    assert_eq!(queued_attempts.len(), 1);
    assert_eq!(queued_attempts[0]["response"]["status_code"], 404);
    assert_eq!(fixture.callback_sender.received_requests().len(), 2);
}

// AC: SM-08.3
#[tokio::test]
async fn a_callback_cut_off_by_a_restart_is_sent_again() {
    let fixture = build_fixture(Vec::new()).await;
    let sms_id = fixture.send_native_sms().await;
    let first_attempts = fixture.wait_for_callback_attempts(&sms_id, 2).await;
    let attempt_repository = &fixture.operation_context.sms_callback_attempt_repository;
    attempt_repository
        .insert_attempt(SmsCallbackAttemptRecord {
            attempt_id: "01INFLIGHT".to_owned(),
            sms_id: sms_id.clone(),
            reported_status: "sent".to_owned(),
            attempt: 1,
            status: "in_flight".to_owned(),
            request_json: first_attempts[0]["request"].to_string(),
            response_json: None,
            duration_ms: None,
            error_message: None,
            next_attempt_at_unix_ms: None,
            created_at_unix_ms: START_UNIX_MS + 1,
        })
        .await
        .unwrap_or_else(|error| panic!("an in-flight attempt: {error}"));

    let requeued_count = attempt_repository
        .requeue_in_flight(START_UNIX_MS)
        .await
        .unwrap_or_else(|error| panic!("a requeue: {error}"));
    let resent_count = fixture.run_retries_after_ms(0).await;

    let sent_attempts = fixture
        .read_callback_attempts_reporting(&sms_id, "sent")
        .await;
    assert_eq!((requeued_count, resent_count), (1, 1));
    assert_eq!(sent_attempts.len(), 2);
    assert!(
        sent_attempts
            .iter()
            .all(|callback_attempt| callback_attempt["response"]["status_code"] == 204)
    );
    assert_eq!(fixture.callback_sender.received_requests().len(), 3);
}
