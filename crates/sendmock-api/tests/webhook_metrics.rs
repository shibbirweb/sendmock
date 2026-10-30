#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod scripted_webhook_sender;
    pub mod test_app;
    pub mod webhook_samples;
    pub mod webhook_send_fixture;
}

use std::sync::Arc;

use sendmock_store::WebhookDeliveryRecord;
use serde_json::{Value, json};
use support::manual_clock::ManualClock;
use support::scripted_webhook_sender::{ScriptedAnswer, ScriptedWebhookSender};
use support::test_app::{build_test_app_with, call_api};
use support::webhook_send_fixture::WebhookSendFixture;

const START_UNIX_MS: i64 = 1_767_225_600_000;
const MINUTE_MS: i64 = 60 * 1_000;
const HOUR_MS: i64 = 60 * MINUTE_MS;
const DAY_MS: i64 = 24 * HOUR_MS;

/// A send fixture whose clock the test can move, answering webhooks from `scripted_answers`.
fn build_clocked_fixture(
    now_unix_ms: i64,
    scripted_answers: &[ScriptedAnswer],
) -> (WebhookSendFixture, Arc<ManualClock>) {
    let manual_clock = Arc::new(ManualClock::new(now_unix_ms));
    let webhook_sender = Arc::new(ScriptedWebhookSender::answering(scripted_answers));
    let fixture_clock = Arc::clone(&manual_clock);
    let (app_router, operation_context) = build_test_app_with(|mut operation_context| {
        operation_context.clock = fixture_clock;
        operation_context.with_webhook_sender(webhook_sender.clone())
    });
    let fixture = WebhookSendFixture {
        app_router,
        operation_context,
        webhook_sender,
    };
    (fixture, manual_clock)
}

fn build_metrics_fixture(now_unix_ms: i64) -> WebhookSendFixture {
    build_clocked_fixture(now_unix_ms, &[]).0
}

/// An attempt as the dispatcher stores it, answered with `status_code` when one is given.
fn logged_attempt(
    delivery_id: &str,
    endpoint_id: &str,
    status: &str,
    created_at_unix_ms: i64,
    status_code: Option<u16>,
) -> WebhookDeliveryRecord {
    WebhookDeliveryRecord {
        delivery_id: delivery_id.to_owned(),
        endpoint_id: endpoint_id.to_owned(),
        endpoint_name: "Orders app".to_owned(),
        rule_id: None,
        event_id: format!("evt_{delivery_id}"),
        event_type: "email.received".to_owned(),
        event_json: None,
        subject_id: None,
        trigger: "auto".to_owned(),
        attempt: 1,
        status: status.to_owned(),
        retry_policy_json: "{}".to_owned(),
        rendered_request_json: (status != "render_failed").then(|| "{}".to_owned()),
        sent_request_json: None,
        response_json: status_code.map(|status_code| {
            json!({ "status_code": status_code, "headers": {}, "body": "", "is_body_truncated": false })
                .to_string()
        }),
        duration_ms: None,
        error_message: None,
        next_attempt_at_unix_ms: None,
        created_at_unix_ms,
    }
}

/// An attempt to log: its id, status, when it was made, the status code and the duration.
type AttemptRow = (&'static str, &'static str, i64, Option<u16>, Option<u32>);

fn build_attempts(endpoint_id: &str, attempt_rows: &[AttemptRow]) -> Vec<WebhookDeliveryRecord> {
    attempt_rows
        .iter()
        .map(
            |(delivery_id, status, created_at_unix_ms, status_code, duration_ms)| {
                let mut attempt = logged_attempt(
                    delivery_id,
                    endpoint_id,
                    status,
                    *created_at_unix_ms,
                    *status_code,
                );
                attempt.duration_ms = *duration_ms;
                attempt
            },
        )
        .collect()
}

async fn log_attempts(fixture: &WebhookSendFixture, attempts: Vec<WebhookDeliveryRecord>) {
    for attempt in attempts {
        fixture
            .operation_context
            .webhook_delivery_repository
            .insert_delivery(attempt)
            .await
            .unwrap_or_else(|error| panic!("the attempt is stored: {error}"));
    }
}

async fn get_json(fixture: &WebhookSendFixture, path: &str) -> Value {
    let (status, answer) = call_api(&fixture.app_router, "GET", path, None).await;
    assert_eq!(status, 200, "{answer}");
    answer
}

fn bucket_counts(metrics: &Value, bucket_index: usize) -> (u64, u64, u64) {
    let bucket = &metrics["buckets"][bucket_index];
    let read_count = |count_key: &str| bucket[count_key].as_u64().unwrap_or(u64::MAX);
    (
        read_count("succeeded_count"),
        read_count("retrying_count"),
        read_count("failed_count"),
    )
}

const CURRENT_HOUR_UNIX_MS: i64 = START_UNIX_MS + 10 * HOUR_MS;

/// Attempts across the last 24 hours, plus one older, for the 24-hour range.
const LAST_DAY_ATTEMPTS: [AttemptRow; 6] = [
    (
        "old",
        "succeeded",
        START_UNIX_MS - 20 * HOUR_MS,
        Some(200),
        Some(900),
    ),
    (
        "unrendered",
        "render_failed",
        CURRENT_HOUR_UNIX_MS - 2 * HOUR_MS,
        None,
        None,
    ),
    (
        "exhausted",
        "exhausted",
        CURRENT_HOUR_UNIX_MS - HOUR_MS,
        Some(500),
        Some(200),
    ),
    (
        "first",
        "succeeded",
        CURRENT_HOUR_UNIX_MS + 5 * MINUTE_MS,
        Some(200),
        Some(100),
    ),
    (
        "retried",
        "succeeded",
        CURRENT_HOUR_UNIX_MS + 10 * MINUTE_MS,
        Some(200),
        Some(300),
    ),
    (
        "waiting",
        "failed",
        CURRENT_HOUR_UNIX_MS + 20 * MINUTE_MS,
        Some(503),
        Some(50),
    ),
];

/// Attempts over the last week and one before it, for the 7-day range.
const LAST_WEEK_ATTEMPTS: [AttemptRow; 4] = [
    (
        "too-old",
        "succeeded",
        START_UNIX_MS - 5 * DAY_MS,
        Some(200),
        None,
    ),
    (
        "first-day",
        "succeeded",
        START_UNIX_MS - 4 * DAY_MS + HOUR_MS,
        Some(200),
        None,
    ),
    (
        "yesterday",
        "exhausted",
        START_UNIX_MS + DAY_MS + 5 * HOUR_MS,
        Some(500),
        None,
    ),
    (
        "today",
        "succeeded",
        START_UNIX_MS + 2 * DAY_MS + HOUR_MS,
        Some(200),
        None,
    ),
];

async fn log_last_day(fixture: &WebhookSendFixture, endpoint_id: &str) {
    let mut attempts = build_attempts(endpoint_id, &LAST_DAY_ATTEMPTS);
    attempts[4].attempt = 2;
    attempts[5].next_attempt_at_unix_ms = Some(CURRENT_HOUR_UNIX_MS + HOUR_MS);
    log_attempts(fixture, attempts).await;
}

// AC: WH-11.1
#[tokio::test]
async fn metrics_for_24_hours_report_volume_success_rate_latency_and_failures() {
    let fixture = build_metrics_fixture(START_UNIX_MS + 10 * HOUR_MS + 30 * MINUTE_MS);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    log_last_day(&fixture, &endpoint_id).await;

    let metrics = get_json(&fixture, "/api/v1/webhooks/metrics?range=24h").await;

    assert_eq!(metrics["range"], "24h");
    assert_eq!(metrics["endpoint_id"], Value::Null);
    assert_eq!(metrics["delivery_count"], 5);
    assert_eq!(metrics["success_rate"], 0.5);
    assert_eq!(metrics["p50_latency_ms"], 100);
    assert_eq!(metrics["p95_latency_ms"], 300);
    assert_eq!(metrics["retry_count"], 1);
    assert_eq!(metrics["render_failed_count"], 1);
    assert_eq!(
        metrics["top_failure_codes"],
        json!([
            { "failure_code": "500", "failure_count": 1 },
            { "failure_code": "503", "failure_count": 1 },
            { "failure_code": "render_failed", "failure_count": 1 },
        ])
    );
    let endpoint_metrics = &metrics["endpoint_metrics"][0];
    assert_eq!(endpoint_metrics["endpoint_id"], json!(endpoint_id));
    assert_eq!(endpoint_metrics["delivery_count"], 5);
    assert_eq!(endpoint_metrics["p95_latency_ms"], 300);
}

// AC: WH-11.3
#[tokio::test]
async fn the_24_hour_chart_stacks_each_hour_by_outcome_with_its_latency() {
    let fixture = build_metrics_fixture(START_UNIX_MS + 10 * HOUR_MS + 30 * MINUTE_MS);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    log_last_day(&fixture, &endpoint_id).await;

    let metrics = get_json(&fixture, "/api/v1/webhooks/metrics?range=24h").await;

    let buckets = metrics["buckets"].as_array().cloned().unwrap_or_default();
    assert_eq!(buckets.len(), 24);
    assert_eq!(buckets[23]["bucket_start"], "2026-01-01T10:00:00Z");
    assert_eq!(buckets[0]["bucket_start"], "2025-12-31T11:00:00Z");
    assert_eq!(bucket_counts(&metrics, 23), (2, 1, 0));
    assert_eq!(buckets[23]["p50_latency_ms"], 100);
    assert_eq!(buckets[23]["p95_latency_ms"], 300);
    assert_eq!(bucket_counts(&metrics, 22), (0, 0, 1));
    assert_eq!(bucket_counts(&metrics, 21), (0, 0, 1));
    assert_eq!(buckets[21]["p50_latency_ms"], Value::Null);
    let recent_failure_ids: Vec<&str> = metrics["recent_failures"]
        .as_array()
        .map(|failures| {
            failures
                .iter()
                .filter_map(|failure| failure["delivery_id"].as_str())
                .collect()
        })
        .unwrap_or_default();
    assert_eq!(
        recent_failure_ids,
        vec!["waiting", "exhausted", "unrendered"]
    );
    assert_eq!(metrics["recent_failures"][0]["status_code"], 503);
}

// AC: WH-11.3
#[tokio::test]
async fn the_7_day_range_counts_by_utc_day_and_narrows_to_one_endpoint() {
    let fixture = build_metrics_fixture(START_UNIX_MS + 2 * DAY_MS + 3 * HOUR_MS);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    let other_endpoint_id = fixture.create_endpoint(json!({ "name": "Billing" })).await;
    let mut attempts = build_attempts(&endpoint_id, &LAST_WEEK_ATTEMPTS);
    attempts.extend(build_attempts(
        &other_endpoint_id,
        &[(
            "other",
            "failed",
            START_UNIX_MS + 2 * DAY_MS + HOUR_MS,
            Some(404),
            None,
        )],
    ));
    log_attempts(&fixture, attempts).await;

    let metrics = get_json(
        &fixture,
        &format!("/api/v1/webhooks/metrics?range=7d&endpoint_id={endpoint_id}"),
    )
    .await;

    assert_eq!(metrics["range"], "7d");
    assert_eq!(metrics["endpoint_id"], json!(endpoint_id));
    assert_eq!(metrics["delivery_count"], 3);
    assert_eq!(metrics["buckets"].as_array().map(Vec::len), Some(7));
    assert_eq!(
        metrics["buckets"][6]["bucket_start"],
        "2026-01-03T00:00:00Z"
    );
    assert_eq!(bucket_counts(&metrics, 6), (1, 0, 0));
    assert_eq!(bucket_counts(&metrics, 5), (0, 0, 1));
    assert_eq!(bucket_counts(&metrics, 0), (1, 0, 0));
    assert_eq!(
        metrics["endpoint_metrics"].as_array().map(Vec::len),
        Some(1)
    );
    assert_eq!(metrics["top_failure_codes"][0]["failure_code"], "500");
}

// AC: WH-11.3
#[tokio::test]
async fn an_unknown_range_is_refused() {
    let fixture = build_metrics_fixture(START_UNIX_MS);

    let (status, answer) = call_api(
        &fixture.app_router,
        "GET",
        "/api/v1/webhooks/metrics?range=30d",
        None,
    )
    .await;

    assert_eq!(status, 400, "{answer}");
}

/// Two manual sends: the first answer fails and is retried, the others succeed.
async fn send_and_retry(fixture: &WebhookSendFixture, manual_clock: &ManualClock) {
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    fixture.send_manually(&endpoint_id, &json!({})).await;
    fixture.send_manually(&endpoint_id, &json!({})).await;
    fixture.run_due().await;
    manual_clock.advance_ms(60 * 1_000);
    fixture.run_due().await;
}

fn build_retrying_fixture() -> (WebhookSendFixture, Arc<ManualClock>) {
    build_clocked_fixture(
        START_UNIX_MS + 30 * MINUTE_MS,
        &[ScriptedAnswer::Status(500)],
    )
}

fn ids_of(deliveries: &[Value]) -> Vec<String> {
    deliveries
        .iter()
        .filter_map(|delivery| delivery["id"].as_str().map(str::to_owned))
        .collect()
}

// AC: WH-11.2
#[tokio::test]
async fn stats_numbers_match_the_delivery_log() {
    let (fixture, manual_clock) = build_retrying_fixture();
    send_and_retry(&fixture, &manual_clock).await;

    let delivery_log = get_json(&fixture, "/api/v1/webhooks/deliveries").await;
    let failed_log = get_json(&fixture, "/api/v1/webhooks/deliveries?status=failed").await;
    let stats = get_json(&fixture, "/api/v1/stats").await;

    let logged = delivery_log["items"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let succeeded_count = logged
        .iter()
        .filter(|delivery| delivery["status"] == "succeeded")
        .count();
    let longest_ms = logged
        .iter()
        .filter_map(|delivery| delivery["duration_ms"].as_u64())
        .max();
    assert_eq!(stats["webhook_delivery_count"], delivery_log["total_count"]);
    assert_eq!(logged.len(), 3);
    assert_eq!(
        stats["webhook_success_rate"],
        json!(succeeded_count as f64 / 3.0)
    );
    assert_eq!(stats["webhook_p95_latency_ms"], json!(longest_ms));
    let failed = failed_log["items"].as_array().cloned().unwrap_or_default();
    let failure_ids: Vec<String> = stats["recent_failures"]
        .as_array()
        .map(|failures| {
            failures
                .iter()
                .filter_map(|failure| failure["delivery_id"].as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    assert_eq!(failure_ids, ids_of(&failed));
    assert_eq!(stats["endpoint_metrics"][0]["delivery_count"], 3);
    assert_eq!(stats["endpoint_metrics"][0]["retry_count"], 1);
    let hourly_deliveries: u64 = stats["activity"]
        .as_array()
        .map(|buckets| {
            buckets
                .iter()
                .filter_map(|bucket| bucket["webhook_delivery_count"].as_u64())
                .sum()
        })
        .unwrap_or_default();
    assert_eq!(hourly_deliveries, 3);
}

// AC: WH-11.2
#[tokio::test]
async fn webhook_metrics_numbers_match_the_delivery_log() {
    let (fixture, manual_clock) = build_retrying_fixture();
    send_and_retry(&fixture, &manual_clock).await;

    let delivery_log = get_json(&fixture, "/api/v1/webhooks/deliveries").await;
    let metrics = get_json(&fixture, "/api/v1/webhooks/metrics?range=24h").await;

    assert_eq!(metrics["delivery_count"], delivery_log["total_count"]);
    assert_eq!(metrics["retry_count"], 1);
    assert_eq!(bucket_counts(&metrics, 23), (2, 0, 1));
    assert_eq!(
        metrics["top_failure_codes"],
        json!([{ "failure_code": "500", "failure_count": 1 }])
    );
}
