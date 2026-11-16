#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const FCM_SEND_PATH: &str = "/providers/fcm/v1/projects/shop-app/messages:send";

async fn call_ok(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    body: Option<&Value>,
) -> Value {
    let (status, answer) = call_api(app_router, method, path, body).await;
    assert!(
        (200..300).contains(&status),
        "{method} {path}: {status} {answer}"
    );
    answer
}

async fn read_stats(app_router: &axum::Router) -> Value {
    call_ok(app_router, "GET", "/api/v1/stats", None).await
}

async fn read_only_thread(app_router: &axum::Router) -> Value {
    let threads = call_ok(app_router, "GET", "/api/v1/sms/threads", None).await;
    assert_eq!(threads.as_array().map(Vec::len), Some(1), "{threads}");
    threads[0].clone()
}

async fn send_sms(app_router: &axum::Router, body: &str) {
    let sms = json!({ "from": "+15550001111", "to": "+8801700000000", "body": body });
    call_ok(app_router, "POST", "/api/v1/sms", Some(&sms)).await;
}

// AC: UI-14.3
#[tokio::test]
async fn marking_a_conversation_unread_flags_its_newest_message_and_read_clears_it() {
    let (app_router, _) = build_test_app();
    send_sms(&app_router, "first").await;
    send_sms(&app_router, "second").await;
    let thread = read_only_thread(&app_router).await;
    let thread_path = format!(
        "/api/v1/sms/threads/{}",
        thread["thread_id"].as_str().unwrap_or_default()
    );
    assert_eq!(
        thread["unread_count"], 0,
        "messages your app sent arrive read"
    );

    let (unread_status, _) = call_api(
        &app_router,
        "PATCH",
        &thread_path,
        Some(&json!({ "is_read": false })),
    )
    .await;
    let unread_thread = read_only_thread(&app_router).await;
    let unread_stats = read_stats(&app_router).await;
    let (read_status, _) = call_api(
        &app_router,
        "PATCH",
        &thread_path,
        Some(&json!({ "is_read": true })),
    )
    .await;
    let read_thread = read_only_thread(&app_router).await;

    assert_eq!(unread_status, 204);
    assert_eq!(unread_thread["unread_count"], 1);
    assert_eq!(unread_thread["last_message"]["is_read"], false);
    assert_eq!(unread_stats["unread_sms_count"], 1);
    assert_eq!(read_status, 204);
    assert_eq!(read_thread["unread_count"], 0);
}

// AC: UI-14.3
#[tokio::test]
async fn a_conversation_that_does_not_exist_answers_404() {
    let (app_router, _) = build_test_app();

    let (status, answer) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/sms/threads/sms-1-2",
        Some(&json!({ "is_read": true })),
    )
    .await;

    assert_eq!(status, 404, "{answer}");
}

// AC: UI-14.3
#[tokio::test]
async fn a_push_arrives_unread_counts_in_the_stats_and_can_be_marked_read() {
    let (app_router, _) = build_test_app();
    let push = json!({ "message": { "token": "device-1", "notification": { "title": "Hi" } } });
    call_ok(&app_router, "POST", FCM_SEND_PATH, Some(&push)).await;
    let pushes = call_ok(&app_router, "GET", "/api/v1/push", None).await;
    let push_id = pushes["items"][0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let stats_before = read_stats(&app_router).await;

    let marked = call_ok(
        &app_router,
        "PATCH",
        &format!("/api/v1/push/{push_id}"),
        Some(&json!({ "is_read": true })),
    )
    .await;
    let stats_after = read_stats(&app_router).await;

    assert_eq!(pushes["items"][0]["is_read"], false);
    assert_eq!(stats_before["unread_push_count"], 1);
    assert_eq!(marked["is_read"], true);
    assert_eq!(stats_after["unread_push_count"], 0);
}

// AC: UI-14.3
#[tokio::test]
async fn a_captured_request_arrives_unread_and_can_be_marked_read_and_unread() {
    let (app_router, _) = build_test_app();
    call_ok(
        &app_router,
        "POST",
        "/catch/orders",
        Some(&json!({ "order": 1 })),
    )
    .await;
    let requests = call_ok(&app_router, "GET", "/api/v1/http/requests", None).await;
    let request_path = format!(
        "/api/v1/http/requests/{}",
        requests["items"][0]["id"].as_str().unwrap_or_default()
    );
    let stats_before = read_stats(&app_router).await;

    let read_request = call_ok(
        &app_router,
        "PATCH",
        &request_path,
        Some(&json!({ "is_read": true })),
    )
    .await;
    let stats_read = read_stats(&app_router).await;
    let unread_request = call_ok(
        &app_router,
        "PATCH",
        &request_path,
        Some(&json!({ "is_read": false })),
    )
    .await;

    assert_eq!(requests["items"][0]["is_read"], false);
    assert_eq!(stats_before["unread_http_request_count"], 1);
    assert_eq!(read_request["is_read"], true);
    assert_eq!(stats_read["unread_http_request_count"], 0);
    assert_eq!(unread_request["is_read"], false);
}

// AC: UI-14.3
#[tokio::test]
async fn marking_a_push_or_request_that_does_not_exist_answers_404() {
    let (app_router, _) = build_test_app();
    let mark_read = json!({ "is_read": true });

    let (push_status, _) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/push/missing",
        Some(&mark_read),
    )
    .await;
    let (request_status, _) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/http/requests/missing",
        Some(&mark_read),
    )
    .await;

    assert_eq!(push_status, 404);
    assert_eq!(request_status, 404);
}

// AC: UI-14.2
#[tokio::test]
async fn deleting_a_conversation_removes_its_messages_and_leaves_the_others() {
    let (app_router, _) = build_test_app();
    send_sms(&app_router, "to the first contact").await;
    let other_contact = json!({ "from": "+15550001111", "to": "+8801800000000", "body": "other" });
    call_ok(&app_router, "POST", "/api/v1/sms", Some(&other_contact)).await;
    let threads = call_ok(&app_router, "GET", "/api/v1/sms/threads", None).await;
    let deleted_thread_id = threads[1]["thread_id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    let (status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("/api/v1/sms/threads/{deleted_thread_id}"),
        None,
    )
    .await;
    let remaining = call_ok(&app_router, "GET", "/api/v1/sms/threads", None).await;

    assert_eq!(status, 204);
    assert_eq!(remaining.as_array().map(Vec::len), Some(1), "{remaining}");
    assert_ne!(remaining[0]["thread_id"], deleted_thread_id);
}

// AC: UI-14.2
#[tokio::test]
async fn deleting_one_captured_request_removes_only_that_request() {
    let (app_router, _) = build_test_app();
    call_ok(
        &app_router,
        "POST",
        "/catch/orders",
        Some(&json!({ "order": 1 })),
    )
    .await;
    call_ok(
        &app_router,
        "POST",
        "/catch/orders",
        Some(&json!({ "order": 2 })),
    )
    .await;
    let requests = call_ok(&app_router, "GET", "/api/v1/http/requests", None).await;
    let deleted_id = requests["items"][0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    let (status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("/api/v1/http/requests/{deleted_id}"),
        None,
    )
    .await;
    let remaining = call_ok(&app_router, "GET", "/api/v1/http/requests", None).await;

    assert_eq!(status, 204);
    assert_eq!(remaining["total_count"], 1);
    assert_ne!(remaining["items"][0]["id"], deleted_id);
}
