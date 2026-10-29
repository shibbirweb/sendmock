#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::Value;
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

async fn send_vonage(app_router: &axum::Router, content_type: &str, body: &str) -> (u16, Value) {
    let request = Request::post("/providers/vonage/sms/json")
        .header("content-type", content_type)
        .body(Body::from(body.to_owned()))
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

// AC: SM-04.1
#[tokio::test]
async fn a_form_or_json_send_answers_vonages_shape() {
    let (app_router, _) = build_test_app();

    let (form_status, form_answer) = send_vonage(
        &app_router,
        "application/x-www-form-urlencoded",
        "from=AcmeInc&to=447700900000&text=Your+code+is+482913&api_key=k&api_secret=s",
    )
    .await;
    let (json_status, json_answer) = send_vonage(
        &app_router,
        "application/json",
        r#"{"from": "AcmeInc", "to": "447700900001", "text": "Hi", "api_key": "k", "api_secret": "s"}"#,
    )
    .await;
    let (_, stored_messages) = call_api(&app_router, "GET", "/api/v1/sms?query=482913", None).await;

    let sent_message = &form_answer["messages"][0];
    assert_eq!((form_status, json_status), (200, 200));
    assert_eq!(form_answer["message-count"], "1");
    assert_eq!(sent_message["status"], "0");
    assert!(
        sent_message["message-id"]
            .as_str()
            .is_some_and(|message_id| message_id.len() == 16)
    );
    assert_eq!(json_answer["messages"][0]["status"], "0");
    assert_eq!(stored_messages["items"][0]["api"], "vonage");
    assert_eq!(stored_messages["items"][0]["from_number"], "AcmeInc");
    assert_eq!(
        stored_messages["items"][0]["provider_id"],
        sent_message["message-id"]
    );
}

// AC: SM-04.2
#[tokio::test]
async fn errors_use_vonages_status_codes_and_text() {
    let (app_router, _) = build_test_app();
    let form = "application/x-www-form-urlencoded";

    let (missing_status, missing_answer) =
        send_vonage(&app_router, form, "from=AcmeInc&text=Hi").await;
    let (magic_status, magic_answer) =
        send_vonage(&app_router, form, "from=AcmeInc&to=%2B15005550001&text=Hi").await;

    assert_eq!(missing_status, 200);
    assert_eq!(missing_answer["messages"][0]["status"], "2");
    assert_eq!(missing_answer["messages"][0]["error-text"], "Missing to");
    assert_eq!(magic_status, 200);
    assert_eq!(magic_answer["messages"][0]["status"], "3");
    assert_eq!(magic_answer["messages"][0]["error-text"], "Invalid number");
}

// AC: SM-13.2
#[tokio::test]
async fn a_secret_sent_in_the_body_is_masked_in_the_log() {
    let (app_router, _) = build_test_app();

    send_vonage(
        &app_router,
        "application/x-www-form-urlencoded",
        "from=AcmeInc&to=447700900000&text=Hi&api_key=vonage-key&api_secret=vonage-secret",
    )
    .await;
    let (_, logged_page) = call_api(&app_router, "GET", "/api/v1/logs/http?api=vonage", None).await;

    let logged_body = logged_page["items"][0]["request_body"]
        .as_str()
        .unwrap_or_default();
    assert!(logged_body.contains("api_secret=********"), "{logged_body}");
    assert!(!logged_body.contains("vonage-secret"));
}
