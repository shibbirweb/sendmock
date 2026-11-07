#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::time::{Duration, Instant};

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

/// The test app's fixed clock stamps every message at 2026-01-01T00:00:00Z.
const AFTER_EVERY_MESSAGE: &str = "2026-01-01T00:00:01Z";
const BEFORE_EVERY_MESSAGE: &str = "2025-12-31T23:59:59Z";

async fn send_email(app_router: &axum::Router, recipient: &str, subject: &str, text: &str) {
    let (status, sent) = call_api(
        app_router,
        "POST",
        "/api/v1/send",
        Some(&json!({ "from": "app@shop.test", "to": [recipient], "subject": subject, "text": text })),
    )
    .await;
    assert!(status == 200 || status == 201, "{status} {sent}");
}

async fn send_sms(app_router: &axum::Router, recipient: &str, body: &str) {
    let (status, sent) = call_api(
        app_router,
        "POST",
        "/api/v1/sms",
        Some(&json!({ "from": "+15550001111", "to": recipient, "body": body })),
    )
    .await;
    assert_eq!(status, 201, "{sent}");
}

/// Starts a wait in the background, then sends the message it waits for.
async fn wait_while_sending(
    app_router: &axum::Router,
    wait_path: String,
    send_matching_message: impl Future<Output = ()>,
) -> (u16, Value, Duration) {
    let waiting_router = app_router.clone();
    let started_at = Instant::now();
    let pending_wait =
        tokio::spawn(async move { call_api(&waiting_router, "GET", &wait_path, None).await });
    tokio::time::sleep(Duration::from_millis(100)).await;
    send_matching_message.await;
    let (status, answer) = pending_wait.await.unwrap_or_default();
    (status, answer, started_at.elapsed())
}

// AC: PL-03.1
#[tokio::test]
async fn wait_email_returns_as_soon_as_a_match_arrives() {
    let (app_router, _) = build_test_app();

    let (status, waited_email, waited_for) = wait_while_sending(
        &app_router,
        "/api/v1/wait/email?to=sam%40example.test&timeout=10s".to_owned(),
        send_email(&app_router, "sam@example.test", "Welcome", "Hi Sam"),
    )
    .await;

    assert_eq!(status, 200, "{waited_email}");
    assert_eq!(waited_email["subject"], "Welcome");
    assert!(waited_for < Duration::from_secs(5), "{waited_for:?}");
}

// AC: PL-03.1 PL-03.2
#[tokio::test]
async fn wait_email_ignores_mail_older_than_since_and_times_out_with_408() {
    let (app_router, _) = build_test_app();
    send_email(&app_router, "sam@example.test", "Older", "Hi Sam").await;

    let (older_status, older_email) = call_api(
        &app_router,
        "GET",
        &format!(
            "/api/v1/wait/email?to=sam%40example.test&since={BEFORE_EVERY_MESSAGE}&timeout=200ms"
        ),
        None,
    )
    .await;
    let (status, timed_out) = call_api(
        &app_router,
        "GET",
        &format!(
            "/api/v1/wait/email?to=sam%40example.test&since={AFTER_EVERY_MESSAGE}&timeout=300ms"
        ),
        None,
    )
    .await;

    assert_eq!(older_status, 200, "{older_email}");
    assert_eq!(older_email["subject"], "Older");
    assert_eq!(status, 408, "{timed_out}");
}

// AC: PL-03.1
#[tokio::test]
async fn wait_sms_returns_as_soon_as_a_match_arrives() {
    let (app_router, _) = build_test_app();

    let (status, waited_sms, waited_for) = wait_while_sending(
        &app_router,
        "/api/v1/wait/sms?to=%2B8801700000000&timeout=10s".to_owned(),
        send_sms(&app_router, "+8801700000000", "Your code is 4821"),
    )
    .await;

    assert_eq!(status, 200, "{waited_sms}");
    assert_eq!(waited_sms["body"], "Your code is 4821");
    assert!(waited_for < Duration::from_secs(5), "{waited_for:?}");
}

// AC: PL-03.1 PL-03.2
#[tokio::test]
async fn wait_sms_ignores_messages_older_than_since_and_times_out_with_408() {
    let (app_router, _) = build_test_app();
    send_sms(&app_router, "+8801700000000", "Older message").await;

    let (status, timed_out) = call_api(
        &app_router,
        "GET",
        &format!("/api/v1/wait/sms?to=%2B8801700000000&since={AFTER_EVERY_MESSAGE}&timeout=300ms"),
        None,
    )
    .await;

    assert_eq!(status, 408, "{timed_out}");
}

async fn read_otp(app_router: &axum::Router, query: &str) -> Value {
    let (status, otp) = call_api(app_router, "GET", &format!("/api/v1/otp?{query}"), None).await;
    assert_eq!(status, 200, "{query}: {otp}");
    otp["code"].clone()
}

// AC: PL-03.3
#[tokio::test]
async fn otp_answers_the_newest_code_per_recipient_and_channel() {
    let (app_router, _) = build_test_app();
    send_email(
        &app_router,
        "sam@example.test",
        "Code",
        "Your code is 111111",
    )
    .await;
    send_email(
        &app_router,
        "sam@example.test",
        "Code",
        "Your code is 222222",
    )
    .await;
    send_email(
        &app_router,
        "ann@example.test",
        "Code",
        "Your code is 333333",
    )
    .await;
    send_sms(&app_router, "+8801700000000", "Your code is 4444").await;
    send_sms(&app_router, "+8801700000000", "Your code is 5555").await;

    assert_eq!(
        read_otp(&app_router, "to=sam%40example.test").await,
        "222222"
    );
    assert_eq!(
        read_otp(&app_router, "to=ann%40example.test").await,
        "333333"
    );
    assert_eq!(
        read_otp(&app_router, "to=%2B8801700000000&channel=sms").await,
        "5555"
    );
}

// AC: PL-03.3
#[tokio::test]
async fn links_answer_the_newest_email_per_recipient() {
    let (app_router, _) = build_test_app();
    send_email(
        &app_router,
        "sam@example.test",
        "Verify",
        "Open https://shop.test/verify/old",
    )
    .await;
    send_email(
        &app_router,
        "sam@example.test",
        "Verify",
        "Open https://shop.test/verify/new",
    )
    .await;
    send_email(
        &app_router,
        "ann@example.test",
        "Verify",
        "Open https://shop.test/verify/ann",
    )
    .await;

    let (sam_status, sam_links) = call_api(
        &app_router,
        "GET",
        "/api/v1/links?to=sam%40example.test",
        None,
    )
    .await;
    let (_, ann_links) = call_api(
        &app_router,
        "GET",
        "/api/v1/links?to=ann%40example.test",
        None,
    )
    .await;

    assert_eq!(sam_status, 200, "{sam_links}");
    assert_eq!(sam_links["links"], json!(["https://shop.test/verify/new"]));
    assert_eq!(ann_links["links"], json!(["https://shop.test/verify/ann"]));
}

// AC: PL-03.5
#[tokio::test]
async fn a_sample_sms_goes_through_the_normal_path() {
    let (app_router, _) = build_test_app();

    let (status, sample) = call_api(
        &app_router,
        "POST",
        "/api/v1/samples/sms",
        Some(&json!({ "to": "+447700900123" })),
    )
    .await;
    let (_, sms_page) = call_api(&app_router, "GET", "/api/v1/sms?to=%2B447700900123", None).await;

    assert!(status == 200 || status == 201, "{status} {sample}");
    assert_eq!(sample["kind"], "sms");
    assert_eq!(sms_page["items"][0]["id"], sample["id"]);
    assert_eq!(
        read_otp(&app_router, "to=%2B447700900123&channel=sms").await,
        "482913"
    );
}
