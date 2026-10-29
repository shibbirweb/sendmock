#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod scripted_webhook_sender;
    pub mod test_app;
}

use std::sync::Arc;
use std::time::Duration;

use sendmock_ops::{
    AppEvent, DeliveryOrder, DeliveryTrigger, OperationContext, enqueue_webhook_delivery,
    run_due_deliveries, run_webhook_dispatcher,
};
use sendmock_webhooks::{WebhookSecret, sign_payload};
use serde_json::{Value, json};
use support::manual_clock::ManualClock;
use support::scripted_webhook_sender::{ScriptedAnswer, ScriptedWebhookSender};
use support::test_app::{build_test_app_with, call_api};

const START_UNIX_MS: i64 = 1_767_225_600_000;

struct DispatchFixture {
    app_router: axum::Router,
    operation_context: OperationContext,
    manual_clock: Arc<ManualClock>,
    webhook_sender: Arc<ScriptedWebhookSender>,
    endpoint_id: String,
}

async fn build_fixture(
    webhook_sender: ScriptedWebhookSender,
    max_attempts: u32,
) -> DispatchFixture {
    let manual_clock = Arc::new(ManualClock::new(START_UNIX_MS));
    let webhook_sender = Arc::new(webhook_sender);
    let (app_router, operation_context) = build_test_app_with(|mut operation_context| {
        operation_context.clock = manual_clock.clone();
        operation_context.with_webhook_sender(webhook_sender.clone())
    });
    let (status, created_endpoint) = call_api(
        &app_router,
        "POST",
        "/api/v1/webhooks/endpoints",
        Some(&json!({
            "name": "Orders app", "url": "http://localhost:3000/hooks", "method": "POST",
            "headers": { "X-Team": "orders" }, "extra_fields": {}, "template_id": "native",
            "template_mode": "linked", "timeout_ms": 10_000,
            "retry_policy": {
                "max_attempts": max_attempts, "backoff_seconds": [1, 5],
                "retry_on_client_errors": false,
            },
            "is_enabled": true, "query_params": [], "body_mode": "template", "body_fields": [],
            "fields_encoding": "json", "raw_content_type": "application/json", "raw_body": "",
            "render_mode": "strict",
        })),
    )
    .await;
    assert_eq!(status, 201, "{created_endpoint}");
    DispatchFixture {
        app_router,
        operation_context,
        manual_clock,
        webhook_sender,
        endpoint_id: created_endpoint["id"]
            .as_str()
            .unwrap_or_default()
            .to_owned(),
    }
}

impl DispatchFixture {
    async fn enqueue_event(&self, event_id: &str) -> String {
        let stored_endpoint = self
            .operation_context
            .webhook_endpoint_repository
            .find_endpoint(&self.endpoint_id)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| panic!("the endpoint {} exists", self.endpoint_id));
        let queued_delivery = enqueue_webhook_delivery(
            &self.operation_context,
            &stored_endpoint,
            DeliveryOrder {
                app_event: AppEvent {
                    id: event_id.to_owned(),
                    event_type: "email.received".to_owned(),
                    created_at: "2026-01-01T00:00:00Z".to_owned(),
                    data: json!({ "subject": "Welcome" }),
                },
                subject_id: None,
                rule_id: None,
                delivery_trigger: DeliveryTrigger::Automatic,
                send_time_values: serde_json::Map::new(),
            },
        )
        .await
        .unwrap_or_else(|error| panic!("the delivery is queued: {error}"));
        queued_delivery.delivery_id
    }

    async fn run_due(&self) -> usize {
        run_due_deliveries(&self.operation_context, 2)
            .await
            .unwrap_or_else(|error| panic!("the pass runs: {error}"))
    }

    async fn deliveries(&self, query: &str) -> Vec<Value> {
        let (_, page) = call_api(
            &self.app_router,
            "GET",
            &format!("/api/v1/webhooks/deliveries{query}"),
            None,
        )
        .await;
        page["items"].as_array().cloned().unwrap_or_default()
    }

    async fn revealed_secret(&self) -> WebhookSecret {
        let (_, revealed) = call_api(
            &self.app_router,
            "GET",
            &format!("/api/v1/webhooks/endpoints/{}/secret", self.endpoint_id),
            None,
        )
        .await;
        WebhookSecret::parse(revealed["secret"].as_str().unwrap_or_default())
            .unwrap_or_else(|error| panic!("a whsec_ secret: {error}"))
    }
}

fn header<'request>(
    request: &'request sendmock_ops::RecordedHttpRequest,
    name: &str,
) -> &'request str {
    request
        .headers
        .get(name)
        .map(String::as_str)
        .unwrap_or_default()
}

fn sent_header_values(webhook_sender: &ScriptedWebhookSender, header_name: &str) -> Vec<String> {
    webhook_sender
        .received_requests()
        .iter()
        .map(|sent_request| header(sent_request, header_name).to_owned())
        .collect()
}

async fn listed_attempt_statuses(fixture: &DispatchFixture) -> Vec<(Value, Value)> {
    fixture
        .deliveries("")
        .await
        .into_iter()
        .map(|delivery| (delivery["attempt"].clone(), delivery["status"].clone()))
        .collect()
}

async fn count_recent_events(fixture: &DispatchFixture, event_type: &str) -> usize {
    let (_, recent_events) = call_api(
        &fixture.app_router,
        "GET",
        &format!("/api/v1/events/recent?type={event_type}"),
        None,
    )
    .await;
    recent_events.as_array().map(Vec::len).unwrap_or_default()
}

// AC: WH-03.2
// AC: WH-03.4
// AC: WH-04.2
#[tokio::test]
async fn server_errors_retry_with_the_backoff_until_the_delivery_is_exhausted() {
    let fixture = build_fixture(
        ScriptedWebhookSender::answering(&[
            ScriptedAnswer::Status(500),
            ScriptedAnswer::TimedOut,
            ScriptedAnswer::ConnectionRefused,
        ]),
        3,
    )
    .await;
    fixture.enqueue_event("evt_retry").await;

    let first_pass = fixture.run_due().await;
    let pass_before_the_backoff = fixture.run_due().await;
    fixture.manual_clock.advance_ms(1_000);
    let second_pass = fixture.run_due().await;
    fixture.manual_clock.advance_ms(5_000);
    let third_pass = fixture.run_due().await;
    fixture.manual_clock.advance_ms(600_000);
    let pass_after_exhaustion = fixture.run_due().await;

    assert_eq!(
        [
            first_pass,
            pass_before_the_backoff,
            second_pass,
            third_pass,
            pass_after_exhaustion
        ],
        [1, 0, 1, 1, 0]
    );
    assert_eq!(
        sent_header_values(&fixture.webhook_sender, "webhook-id"),
        vec!["evt_retry"; 3]
    );
    assert_eq!(
        sent_header_values(&fixture.webhook_sender, "webhook-attempt"),
        vec!["1", "2", "3"]
    );
    assert_eq!(
        listed_attempt_statuses(&fixture).await,
        vec![
            (json!(3), json!("exhausted")),
            (json!(2), json!("failed")),
            (json!(1), json!("failed")),
        ]
    );
    assert_eq!(count_recent_events(&fixture, "webhook.failed").await, 1);
    assert_eq!(count_recent_events(&fixture, "webhook.delivered").await, 3);
}

// AC: WH-03.2
#[tokio::test]
async fn client_errors_fail_without_a_retry() {
    let fixture = build_fixture(
        ScriptedWebhookSender::answering(&[ScriptedAnswer::Status(404)]),
        5,
    )
    .await;
    fixture.enqueue_event("evt_not_found").await;

    fixture.run_due().await;
    fixture.manual_clock.advance_ms(600_000);
    let later_pass = fixture.run_due().await;

    let deliveries = fixture.deliveries("?status=failed").await;
    assert_eq!(later_pass, 0);
    assert_eq!(deliveries.len(), 1);
    assert_eq!(deliveries[0]["next_attempt_at"], Value::Null);
    assert_eq!(deliveries[0]["error_message"], "Your app answered 404");
}

// AC: WH-04.1
#[tokio::test]
async fn native_deliveries_carry_a_verifiable_standard_webhooks_signature() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), 5).await;
    fixture.enqueue_event("evt_signed").await;

    fixture.run_due().await;

    let sent_request = &fixture.webhook_sender.received_requests()[0];
    let timestamp_seconds: i64 = header(sent_request, "webhook-timestamp")
        .parse()
        .unwrap_or_default();
    let body: Value = serde_json::from_str(&sent_request.body).unwrap_or(Value::Null);
    assert_eq!(timestamp_seconds, START_UNIX_MS / 1_000);
    assert_eq!(
        header(sent_request, "webhook-signature"),
        sign_payload(
            &fixture.revealed_secret().await,
            "evt_signed",
            timestamp_seconds,
            &sent_request.body
        )
    );
    assert_eq!(body["type"], "email.received");
    assert_eq!(body["id"], "evt_signed");
    assert_eq!(header(sent_request, "x-team"), "orders");
    assert_eq!(header(sent_request, "content-type"), "application/json");
    assert_eq!(fixture.deliveries("?status=succeeded").await.len(), 1);
}

// AC: WH-04.3
#[tokio::test]
async fn a_rotated_secret_signs_next_to_the_old_one_until_the_overlap_ends() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), 5).await;
    let old_secret = fixture.revealed_secret().await;
    call_api(
        &fixture.app_router,
        "POST",
        &format!(
            "/api/v1/webhooks/endpoints/{}/rotate-secret",
            fixture.endpoint_id
        ),
        Some(&json!({ "overlap_hours": 1 })),
    )
    .await;
    let new_secret = fixture.revealed_secret().await;

    fixture.enqueue_event("evt_during_overlap").await;
    fixture.run_due().await;
    fixture.manual_clock.advance_ms(3_600_001);
    fixture.enqueue_event("evt_after_overlap").await;
    fixture.run_due().await;

    let sent_requests = fixture.webhook_sender.received_requests();
    let expected_signature = |secret: &WebhookSecret, request_index: usize, event_id: &str| {
        let sent_request = &sent_requests[request_index];
        let timestamp_seconds = header(sent_request, "webhook-timestamp")
            .parse()
            .unwrap_or_default();
        sign_payload(secret, event_id, timestamp_seconds, &sent_request.body)
    };
    assert_eq!(
        header(&sent_requests[0], "webhook-signature"),
        format!(
            "{} {}",
            expected_signature(&new_secret, 0, "evt_during_overlap"),
            expected_signature(&old_secret, 0, "evt_during_overlap")
        )
    );
    assert_eq!(
        header(&sent_requests[1], "webhook-signature"),
        expected_signature(&new_secret, 1, "evt_after_overlap")
    );
}

// AC: WH-03.9
#[tokio::test]
async fn cancelling_stops_the_remaining_retries() {
    let fixture = build_fixture(
        ScriptedWebhookSender::answering(&[ScriptedAnswer::Status(503)]),
        5,
    )
    .await;
    let delivery_id = fixture.enqueue_event("evt_cancelled").await;
    fixture.run_due().await;
    let cancel_path = format!("/api/v1/webhooks/deliveries/{delivery_id}/cancel");

    let (cancel_status, cancelled_delivery) =
        call_api(&fixture.app_router, "POST", &cancel_path, None).await;
    let (second_cancel_status, _) = call_api(&fixture.app_router, "POST", &cancel_path, None).await;
    fixture.manual_clock.advance_ms(600_000);
    let later_pass = fixture.run_due().await;

    assert_eq!(cancel_status, 200, "{cancelled_delivery}");
    assert_eq!(cancelled_delivery["status"], "cancelled");
    assert_eq!(cancelled_delivery["next_attempt_at"], Value::Null);
    assert_eq!(second_cancel_status, 409);
    assert_eq!(later_pass, 0);
}

// AC: WH-03.6
#[tokio::test]
async fn no_more_than_the_limit_are_in_flight_at_once() {
    let fixture = build_fixture(
        ScriptedWebhookSender::answering_slowly(Duration::from_millis(30)),
        5,
    )
    .await;
    for event_number in 0..5 {
        fixture.enqueue_event(&format!("evt_{event_number}")).await;
    }

    let attempt_counts = [
        fixture.run_due().await,
        fixture.run_due().await,
        fixture.run_due().await,
    ];

    assert_eq!(attempt_counts, [2, 2, 1]);
    assert_eq!(fixture.webhook_sender.most_in_flight(), 2);
}

// AC: WH-03.5
// AC: WH-03.8
#[tokio::test]
async fn the_detail_lists_every_attempt_with_its_request_and_response() {
    let fixture = build_fixture(
        ScriptedWebhookSender::answering(&[ScriptedAnswer::Status(500)]),
        3,
    )
    .await;
    fixture.enqueue_event("evt_detail").await;
    fixture.run_due().await;
    fixture.manual_clock.advance_ms(1_000);
    fixture.run_due().await;
    let latest_delivery_id = fixture.deliveries("").await[0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    let (status, delivery_detail) = call_api(
        &fixture.app_router,
        "GET",
        &format!("/api/v1/webhooks/deliveries/{latest_delivery_id}"),
        None,
    )
    .await;

    assert_eq!(status, 200);
    assert_eq!(delivery_detail["max_attempts"], 3);
    assert_eq!(delivery_detail["status"], "succeeded");
    assert_eq!(
        delivery_detail["request"]["headers"]["webhook-id"],
        "evt_detail"
    );
    assert_eq!(delivery_detail["response"]["status_code"], 200);
    assert_eq!(delivery_detail["duration_ms"], 3);
    assert_eq!(
        delivery_detail["attempts"]
            .as_array()
            .map(|attempts| attempts
                .iter()
                .map(|attempt| attempt["status_code"].clone())
                .collect::<Vec<_>>()),
        Some(vec![json!(500), json!(200)])
    );
}

// AC: PL-03.1
#[tokio::test]
async fn wait_returns_a_finished_delivery_and_times_out_without_one() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), 5).await;
    let (timeout_status, _) = call_api(
        &fixture.app_router,
        "GET",
        "/api/v1/wait/webhook?endpoint=Orders%20app&timeout=200ms",
        None,
    )
    .await;
    fixture.enqueue_event("evt_waited").await;
    fixture.run_due().await;

    let (status, finished_delivery) = call_api(
        &fixture.app_router,
        "GET",
        "/api/v1/wait/webhook?endpoint=Orders%20app&event=email.received&status=succeeded&timeout=1s",
        None,
    )
    .await;

    assert_eq!(timeout_status, 408);
    assert_eq!(status, 200, "{finished_delivery}");
    assert_eq!(finished_delivery["event_id"], "evt_waited");
}

/// Waits up to two seconds for the fake app to receive `request_count` requests.
async fn wait_for_requests(webhook_sender: &ScriptedWebhookSender, request_count: usize) -> bool {
    for _ in 0..200 {
        if webhook_sender.received_requests().len() >= request_count {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    false
}

// AC: WH-03.1
#[tokio::test]
async fn queuing_returns_at_once_and_the_dispatcher_sends_in_the_background() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), 5).await;
    let dispatcher = tokio::spawn(run_webhook_dispatcher(fixture.operation_context.clone(), 8));

    fixture.enqueue_event("evt_background").await;
    let requests_right_after_queuing = fixture.webhook_sender.received_requests().len();
    let was_sent = wait_for_requests(&fixture.webhook_sender, 1).await;
    dispatcher.abort();

    assert_eq!(requests_right_after_queuing, 0);
    assert!(was_sent);
}

// AC: WH-03.3
#[tokio::test]
async fn an_attempt_cut_off_by_a_stop_is_sent_after_the_restart() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), 5).await;
    let delivery_id = fixture.enqueue_event("evt_restart").await;
    let was_claimed = fixture
        .operation_context
        .webhook_delivery_repository
        .start_pending_attempt(&delivery_id)
        .await
        .unwrap_or_default();

    let dispatcher = tokio::spawn(run_webhook_dispatcher(fixture.operation_context.clone(), 8));
    let was_sent = wait_for_requests(&fixture.webhook_sender, 1).await;
    dispatcher.abort();

    assert!(was_claimed);
    assert!(was_sent);
    assert_eq!(fixture.deliveries("?status=succeeded").await.len(), 1);
}
