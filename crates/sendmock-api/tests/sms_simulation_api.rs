#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod recording_callback_sender;
    pub mod test_app;
}

use std::sync::Arc;
use std::time::Duration;

use serde_json::{Value, json};
use support::recording_callback_sender::RecordingCallbackSender;
use support::test_app::{build_test_app, build_test_app_with, call_api};

fn sms_to(to_number: &str) -> Value {
    json!({ "from": "+15550001111", "to": to_number, "body": "Your code is 482913" })
}

async fn use_settings(app_router: &axum::Router, settings_change: Value) {
    let (status, _) = call_api(
        app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&settings_change),
    )
    .await;
    assert_eq!(status, 200);
}

async fn read_sms(app_router: &axum::Router, sms_id: &Value) -> Value {
    let sms_id = sms_id.as_str().unwrap_or_default();
    call_api(app_router, "GET", &format!("/api/v1/sms/{sms_id}"), None)
        .await
        .1
}

fn history_statuses(sms_detail: &Value) -> Vec<String> {
    sms_detail["status_history"]
        .as_array()
        .map(|status_history| {
            status_history
                .iter()
                .map(|status_change| {
                    status_change["status"]
                        .as_str()
                        .unwrap_or_default()
                        .to_owned()
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Polls until `is_done` holds, for steps that play out in the background.
async fn wait_until(mut is_done: impl AsyncFnMut() -> bool) {
    for _ in 0..60 {
        if is_done().await {
            return;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

// AC: SM-07.1
// AC: SM-07.6
#[tokio::test]
async fn the_instant_profile_delivers_before_answering_and_records_each_step() {
    let (app_router, _) = build_test_app();
    use_settings(&app_router, json!({ "sms_simulation_profile": "instant" })).await;

    let (status, sent_sms) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&sms_to("+8801700000000")),
    )
    .await;

    assert_eq!(status, 201);
    assert_eq!(sent_sms["status"], "delivered");
    assert_eq!(
        history_statuses(&sent_sms),
        vec!["queued", "sent", "delivered"]
    );
}

// AC: SM-07.1
#[tokio::test]
async fn the_realistic_profile_sends_then_delivers_in_the_background() {
    let (app_router, _) = build_test_app();
    use_settings(
        &app_router,
        json!({ "sms_simulation_profile": "realistic" }),
    )
    .await;

    let (_, sent_sms) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&sms_to("+8801700000000")),
    )
    .await;
    wait_until(async || read_sms(&app_router, &sent_sms["id"]).await["status"] == "delivered")
        .await;

    assert_eq!(sent_sms["status"], "queued");
    assert_eq!(
        history_statuses(&read_sms(&app_router, &sent_sms["id"]).await),
        vec!["queued", "sent", "delivered"]
    );
}

// AC: SM-07.1
#[tokio::test]
async fn the_manual_profile_stops_at_sent() {
    let (app_router, _) = build_test_app();
    use_settings(&app_router, json!({ "sms_simulation_profile": "manual" })).await;

    let (_, sent_sms) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&sms_to("+8801700000000")),
    )
    .await;

    assert_eq!(sent_sms["status"], "sent");
}

// AC: SM-07.2
#[tokio::test]
async fn a_magic_number_is_refused_with_twilios_code_and_not_stored() {
    let (app_router, _) = build_test_app();

    let (status, error_body) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&sms_to("+15005550001")),
    )
    .await;
    let (_, stored_messages) = call_api(&app_router, "GET", "/api/v1/sms", None).await;

    assert_eq!(status, 400);
    assert_eq!(error_body["error"]["code"], "sms_rejected");
    assert_eq!(
        error_body["error"]["message"],
        "Rejected with error 21211 (magic number)"
    );
    assert_eq!(stored_messages["total_count"], 0);
}

// AC: SM-07.3
#[tokio::test]
async fn an_after_send_number_ends_with_its_status_and_code() {
    let (app_router, _) = build_test_app();
    use_settings(&app_router, json!({ "sms_simulation_profile": "instant" })).await;

    let (_, filtered_sms) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&sms_to("+15005550103")),
    )
    .await;

    assert_eq!(filtered_sms["status"], "undelivered");
    assert_eq!(filtered_sms["error_code"], "30007");
}

// AC: SM-07.4
#[tokio::test]
async fn strict_test_mode_refuses_a_sender_that_is_not_a_test_number() {
    let (app_router, _) = build_test_app();
    use_settings(&app_router, json!({ "is_strict_twilio_test_mode": true })).await;

    let (status, error_body) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&sms_to("+8801700000000")),
    )
    .await;

    assert_eq!(status, 400);
    assert_eq!(
        error_body["error"]["message"],
        "Rejected with error 21606 (strict Twilio test mode)"
    );
}

// AC: SM-07.9
#[tokio::test]
async fn with_magic_numbers_off_a_test_number_is_an_ordinary_number() {
    let (app_router, _) = build_test_app();
    let number_test = json!({ "number": "+15005550001", "match_field": "to" });
    let (_, magic_result) = call_api(
        &app_router,
        "POST",
        "/api/v1/outcome-rules/sms/test",
        Some(&number_test),
    )
    .await;
    use_settings(&app_router, json!({ "is_magic_numbers_enabled": false })).await;

    let (status, _) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&sms_to("+15005550001")),
    )
    .await;
    let (_, profile_result) = call_api(
        &app_router,
        "POST",
        "/api/v1/outcome-rules/sms/test",
        Some(&number_test),
    )
    .await;

    assert_eq!(magic_result["source"], "magic");
    assert_eq!(
        magic_result["summary"],
        "Magic number: Invalid number (21211)"
    );
    assert_eq!(status, 201);
    assert_eq!(profile_result["source"], "profile");
    assert_eq!(
        profile_result["summary"],
        "No rule or magic number matches: the realistic profile applies."
    );
}

// AC: SM-08.1
// AC: SM-08.3
#[tokio::test]
async fn the_status_callback_receives_each_status_in_order_and_is_logged() {
    let callback_sender = Arc::new(RecordingCallbackSender::default());
    let sender_for_context = Arc::clone(&callback_sender);
    let (app_router, _) = build_test_app_with(move |operation_context| {
        operation_context.with_status_callback_sender(sender_for_context)
    });
    use_settings(&app_router, json!({ "sms_simulation_profile": "instant" })).await;
    let mut sms_with_callback = sms_to("+8801700000000");
    sms_with_callback["status_callback"] = json!("http://127.0.0.1:9/status");

    let (_, sent_sms) =
        call_api(&app_router, "POST", "/api/v1/sms", Some(&sms_with_callback)).await;
    wait_until(async || {
        read_sms(&app_router, &sent_sms["id"]).await["callback_attempts"]
            .as_array()
            .is_some_and(|callback_attempts| callback_attempts.len() == 3)
    })
    .await;
    let sms_detail = read_sms(&app_router, &sent_sms["id"]).await;

    assert_eq!(
        callback_sender.received_statuses(),
        vec!["queued", "sent", "delivered"]
    );
    assert_eq!(
        sms_detail["callback_attempts"].as_array().map(Vec::len),
        Some(3)
    );
    assert_eq!(
        sms_detail["callback_attempts"][0]["response"]["status_code"],
        204
    );
    assert_eq!(
        sms_detail["callback_attempts"][0]["request"]["url"],
        "http://127.0.0.1:9/status"
    );
}
