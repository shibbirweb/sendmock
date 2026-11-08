#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::io::Write;

use axum::body::Body;
use axum::http::Request;
use flate2::Compression;
use flate2::write::GzEncoder;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const EXPO_SEND_PATH: &str = "/providers/expo/--/api/v2/push/send";
const EXPO_RECEIPTS_PATH: &str = "/providers/expo/--/api/v2/push/getReceipts";

fn expo_message(recipients: Value) -> Value {
    json!({
        "to": recipients,
        "title": "Your order shipped",
        "body": "Track it in the app.",
        "data": { "order_id": "1042" },
        "richContent": { "image": "https://shop.test/parcel.png" },
        "sound": "default",
    })
}

async fn list_pushes(app_router: &axum::Router) -> Value {
    let (status, page) = call_api(app_router, "GET", "/api/v1/push", None).await;
    assert_eq!(status, 200, "{page}");
    page
}

/// Sends the body gzipped, as `expo-server-sdk` does for bodies over 1 KB.
async fn post_gzipped(app_router: &axum::Router, path: &str, json_body: &Value) -> (u16, Value) {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(json_body.to_string().as_bytes())
        .unwrap_or_else(|error| panic!("compressed: {error}"));
    let gzipped_body = encoder
        .finish()
        .unwrap_or_else(|error| panic!("compressed: {error}"));
    let request = Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", "application/json")
        .header("content-encoding", "gzip")
        .body(Body::from(gzipped_body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    (
        status,
        serde_json::from_slice(&body_bytes).unwrap_or(Value::Null),
    )
}

// AC: PN-01.2
#[tokio::test]
async fn a_batch_gets_a_ticket_and_a_stored_notification_per_recipient() {
    let (app_router, _) = build_test_app();
    let batch = json!([
        expo_message(json!("ExponentPushToken[device-1]")),
        expo_message(json!([
            "ExponentPushToken[device-2]",
            "ExponentPushToken[device-3]"
        ])),
    ]);

    let (status, answer) = call_api(&app_router, "POST", EXPO_SEND_PATH, Some(&batch)).await;
    let page = list_pushes(&app_router).await;

    assert_eq!(status, 200, "{answer}");
    let tickets = answer["data"].as_array().cloned().unwrap_or_default();
    assert_eq!(tickets.len(), 3);
    assert!(tickets.iter().all(|ticket| ticket["status"] == "ok"));
    assert_eq!(page["total_count"], 3);
    let first_sent = &page["items"][2];
    assert_eq!(first_sent["provider"], "expo");
    assert_eq!(first_sent["device_token"], "ExponentPushToken[device-1]");
    assert_eq!(first_sent["provider_message_id"], tickets[0]["id"]);
    assert_eq!(first_sent["title"], "Your order shipped");
    assert_eq!(first_sent["body"], "Track it in the app.");
    assert_eq!(first_sent["image_url"], "https://shop.test/parcel.png");
    assert_eq!(first_sent["data"]["order_id"], "1042");
    assert_eq!(first_sent["request"]["sound"], "default");
}

// AC: PN-01.2
#[tokio::test]
async fn a_single_message_to_one_recipient_gets_one_ticket_object() {
    let (app_router, operation_context) = build_test_app();
    let provider_port_router = sendmock_api::build_provider_port_router(&operation_context, None);

    let (status, answer) = call_api(
        &provider_port_router,
        "POST",
        "/--/api/v2/push/send",
        Some(&expo_message(json!("ExponentPushToken[device-1]"))),
    )
    .await;

    assert_eq!(status, 200, "{answer}");
    assert_eq!(answer["data"]["status"], "ok");
    assert_eq!(list_pushes(&app_router).await["total_count"], 1);
}

// AC: PN-01.2
#[tokio::test]
async fn a_gzipped_batch_is_read_as_the_sdk_sends_it() {
    let (app_router, _) = build_test_app();
    let batch = json!([expo_message(json!("ExponentPushToken[device-1]"))]);

    let (status, answer) = post_gzipped(&app_router, EXPO_SEND_PATH, &batch).await;

    assert_eq!(status, 200, "{answer}");
    assert_eq!(answer["data"][0]["status"], "ok");
    assert_eq!(
        list_pushes(&app_router).await["items"][0]["title"],
        "Your order shipped"
    );
}

// AC: PN-01.2
#[tokio::test]
async fn a_message_without_a_recipient_refuses_the_request_in_expos_shape() {
    let (app_router, _) = build_test_app();
    let batch = json!([{ "title": "Nobody" }]);

    let (status, answer) = call_api(&app_router, "POST", EXPO_SEND_PATH, Some(&batch)).await;

    assert_eq!(status, 400);
    assert_eq!(answer["errors"][0]["code"], "VALIDATION_ERROR");
    assert_eq!(answer["errors"][0]["message"], "\"[0].to\" is required.");
    assert_eq!(list_pushes(&app_router).await["total_count"], 0);
}

// AC: PN-01.2
#[tokio::test]
async fn receipts_are_answered_for_issued_tickets_and_unknown_ids_left_out() {
    let (app_router, _) = build_test_app();
    let (_, answer) = call_api(
        &app_router,
        "POST",
        EXPO_SEND_PATH,
        Some(&json!([expo_message(json!("ExponentPushToken[device-1]"))])),
    )
    .await;
    let ticket_id = answer["data"][0]["id"].as_str().unwrap_or_default();

    let (status, receipts) = call_api(
        &app_router,
        "POST",
        EXPO_RECEIPTS_PATH,
        Some(&json!({ "ids": [ticket_id, "unknown-ticket"] })),
    )
    .await;

    assert_eq!(status, 200, "{receipts}");
    assert_eq!(receipts["data"][ticket_id]["status"], "ok");
    assert!(receipts["data"].get("unknown-ticket").is_none());
}
