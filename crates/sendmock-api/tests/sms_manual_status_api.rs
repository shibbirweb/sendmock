#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::time::Duration;

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

/// Longer than the realistic profile's whole lifecycle (sent at 700 ms, delivered at 1.8 s).
const LIFECYCLE_END_MS: u64 = 2_600;

async fn send_with_realistic_profile(app_router: &axum::Router, sms_input: Value) -> String {
    let (settings_status, _) = call_api(
        app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "sms_simulation_profile": "realistic" })),
    )
    .await;
    assert_eq!(settings_status, 200);
    let (send_status, sent_sms) =
        call_api(app_router, "POST", "/api/v1/sms", Some(&sms_input)).await;
    assert_eq!(send_status, 201, "{sent_sms}");
    sent_sms["id"].as_str().unwrap_or_default().to_owned()
}

async fn set_status_by_hand(app_router: &axum::Router, sms_id: &str, status: &str) -> Value {
    let (status_code, answer) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/sms/{sms_id}/status"),
        Some(&json!({ "status": status })),
    )
    .await;
    assert_eq!(status_code, 200, "{answer}");
    answer
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

// AC: SM-24.1
#[tokio::test]
async fn a_final_status_set_by_hand_ends_the_simulated_lifecycle() {
    let (app_router, _) = build_test_app();
    let sms_id = send_with_realistic_profile(
        &app_router,
        json!({ "from": "+15550001111", "to": "+8801700000000", "body": "Hi" }),
    )
    .await;

    set_status_by_hand(&app_router, &sms_id, "failed").await;
    tokio::time::sleep(Duration::from_millis(LIFECYCLE_END_MS)).await;
    let (_, sms_detail) =
        call_api(&app_router, "GET", &format!("/api/v1/sms/{sms_id}"), None).await;

    assert_eq!(sms_detail["status"], "failed", "{sms_detail}");
    assert_eq!(history_statuses(&sms_detail), vec!["queued", "failed"]);
}

// AC: SM-24.2
#[tokio::test]
async fn setting_a_status_by_hand_says_when_its_callback_is_sent() {
    let (app_router, _) = build_test_app();
    let without_callback = send_with_realistic_profile(
        &app_router,
        json!({ "from": "+15550001111", "to": "+8801700000000", "body": "Hi" }),
    )
    .await;
    let with_callback = send_with_realistic_profile(
        &app_router,
        json!({
            "from": "+15550001111", "to": "+8801700000001", "body": "Hi",
            "status_callback": "http://127.0.0.1:9/sms/status",
        }),
    )
    .await;

    let silent_answer = set_status_by_hand(&app_router, &without_callback, "delivered").await;
    let callback_answer = set_status_by_hand(&app_router, &with_callback, "undelivered").await;

    assert_eq!(silent_answer["status"], "delivered");
    assert_eq!(
        silent_answer["status_callback_timing"],
        "No status callback: the message has no status callback URL."
    );
    assert!(
        callback_answer["status_callback_timing"]
            .as_str()
            .unwrap_or_default()
            .starts_with("The status callback is sent to http://127.0.0.1:9/sms/status now"),
        "{callback_answer}"
    );
}
