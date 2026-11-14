#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod test_app;
}

use std::sync::Arc;

use sendmock_ops::{OperationContext, SmtpMessage, store_smtp_message};
use serde_json::{Value, json};
use support::manual_clock::ManualClock;
use support::test_app::{build_test_app_with, call_api};

/// When the test app's email ingest clock stands, which stays put when the context's moves.
const EMAIL_RECEIVED_UNIX_MS: i64 = 1_767_225_600_000;
const HOUR_MS: i64 = 60 * 60 * 1_000;

async fn store_email(operation_context: &OperationContext, subject: &str) {
    let raw_message = format!(
        "From: shop@example.test\r\nTo: sam@example.test\r\nSubject: {subject}\r\n\r\nHello\r\n"
    );
    store_smtp_message(
        operation_context,
        SmtpMessage {
            raw_message: raw_message.into_bytes(),
            mail_from: "shop@example.test".to_owned(),
            recipients: vec!["sam@example.test".to_owned()],
            smtp_session_id: "01JSTATSSESSION00000000000".to_owned(),
            auth_user: None,
        },
    )
    .await
    .unwrap_or_else(|error| panic!("the email is stored: {error}"));
}

async fn post(app_router: &axum::Router, path: &str, request_body: &Value) {
    let (status, answer) = call_api(app_router, "POST", path, Some(request_body)).await;
    assert!(status == 200 || status == 201, "{status} {answer}");
}

#[tokio::test]
async fn stats_count_messages_in_total_today_and_unread_with_hourly_activity() {
    let manual_clock = Arc::new(ManualClock::new(EMAIL_RECEIVED_UNIX_MS + 25 * HOUR_MS));
    let (app_router, operation_context) = build_test_app_with(|mut operation_context| {
        operation_context.clock = manual_clock;
        operation_context
    });
    store_email(&operation_context, "Yesterday one").await;
    store_email(&operation_context, "Yesterday two").await;
    post(
        &app_router,
        "/api/v1/sms",
        &json!({ "from": "+15550001111", "to": "+8801700000000", "body": "Hi" }),
    )
    .await;
    post(
        &app_router,
        "/api/v1/sms/inbound",
        &json!({ "from": "+8801700000000", "to": "+15550001111", "body": "STOP" }),
    )
    .await;
    // The verification's code goes out as one more outgoing SMS.
    post(&app_router, "/api/v1/samples/verification", &json!({})).await;

    let (status, stats) = call_api(&app_router, "GET", "/api/v1/stats", None).await;

    assert_eq!(status, 200, "{stats}");
    assert_eq!(
        (
            stats["email_count"].as_u64(),
            stats["emails_today"].as_u64()
        ),
        (Some(2), Some(0))
    );
    assert_eq!(stats["unread_email_count"], 2);
    assert_eq!(
        (stats["sms_count"].as_u64(), stats["sms_today"].as_u64()),
        (Some(3), Some(3))
    );
    assert_eq!(stats["unread_sms_count"], 1);
    assert_eq!(stats["verification_count"], 1);
    assert_eq!(stats["pending_verification_count"], 1);
    assert_eq!(stats["webhook_delivery_count"], 0);
    assert_eq!(stats["webhook_success_rate"], Value::Null);
    assert_eq!(stats["payment_revenue"], json!([]));
    let activity = stats["activity"].as_array().cloned().unwrap_or_default();
    assert_eq!(activity.len(), 24);
    assert_eq!(activity[23]["bucket_start"], "2026-01-02T01:00:00Z");
    assert_eq!(activity[23]["sms_count"].as_u64(), Some(3));
    let hourly_emails: u64 = activity
        .iter()
        .filter_map(|bucket| bucket["email_count"].as_u64())
        .sum();
    assert_eq!(hourly_emails, 0);
}

async fn create_checkout(app_router: &axum::Router, amount_minor: u64, currency: &str) -> String {
    let (status, payment) = call_api(
        app_router,
        "POST",
        "/api/v1/payments/checkout",
        Some(&json!({ "provider": "stripe", "amount_minor": amount_minor, "currency": currency })),
    )
    .await;
    assert_eq!(status, 201, "{payment}");
    payment["id"].as_str().unwrap_or_default().to_owned()
}

async fn simulate_payment(app_router: &axum::Router, payment_id: &str, request_body: Value) {
    post(
        app_router,
        &format!("/api/v1/payments/{payment_id}/simulate"),
        &request_body,
    )
    .await;
}

/// One USD payment paid before midnight; after it, a USD payment refunded in part, a BDT one
/// paid, a declined one and one still open.
async fn make_payments_across_midnight(app_router: &axum::Router, manual_clock: &ManualClock) {
    let yesterday_payment_id = create_checkout(app_router, 2_000, "USD").await;
    simulate_payment(
        app_router,
        &yesterday_payment_id,
        json!({ "action": "succeed" }),
    )
    .await;
    manual_clock.advance_ms(2 * HOUR_MS);
    let refunded_payment_id = create_checkout(app_router, 2_000, "USD").await;
    simulate_payment(
        app_router,
        &refunded_payment_id,
        json!({ "action": "succeed" }),
    )
    .await;
    simulate_payment(
        app_router,
        &refunded_payment_id,
        json!({ "action": "refund", "refund_amount_minor": 500 }),
    )
    .await;
    let taka_payment_id = create_checkout(app_router, 120_000, "BDT").await;
    simulate_payment(app_router, &taka_payment_id, json!({ "action": "succeed" })).await;
    let declined_payment_id = create_checkout(app_router, 900, "USD").await;
    simulate_payment(
        app_router,
        &declined_payment_id,
        json!({ "action": "decline" }),
    )
    .await;
    create_checkout(app_router, 700, "USD").await;
}

// AC: PY-09.5
#[tokio::test]
async fn stats_count_payments_today_with_the_success_rate_and_net_revenue_per_currency() {
    let start_of_today_unix_ms = EMAIL_RECEIVED_UNIX_MS + 24 * HOUR_MS;
    let manual_clock = Arc::new(ManualClock::new(start_of_today_unix_ms - HOUR_MS));
    let (app_router, _) = build_test_app_with(|mut operation_context| {
        operation_context.clock = manual_clock.clone();
        operation_context
    });
    make_payments_across_midnight(&app_router, &manual_clock).await;

    let (status, stats) = call_api(&app_router, "GET", "/api/v1/stats", None).await;

    assert_eq!(status, 200, "{stats}");
    assert_eq!(
        (&stats["payment_count"], &stats["payments_today"]),
        (&json!(5), &json!(4))
    );
    assert_eq!(stats["payment_success_rate"], json!(0.75));
    assert_eq!(
        stats["payment_revenue"],
        json!([
            { "currency": "BDT", "amount_minor": 120_000 },
            { "currency": "USD", "amount_minor": 3_500 },
        ])
    );
}
