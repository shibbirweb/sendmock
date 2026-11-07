#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod recording_callback_sender;
    pub mod test_app;
}

use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use sendmock_ops::{RecordedHttpRequest, sign_twilio_request};
use serde_json::{Value, json};
use support::recording_callback_sender::RecordingCallbackSender;
use support::test_app::{build_test_app_with, call_api};
use tower::ServiceExt;

const CALLBACK_URL: &str = "http://127.0.0.1:9/sms/status";
/// The shipped Twilio definition's auth token, which signs its callbacks.
const TWILIO_AUTH_TOKEN: &str = "twilio-test-token";

async fn build_app_with_recorder() -> (axum::Router, Arc<RecordingCallbackSender>) {
    let callback_sender = Arc::new(RecordingCallbackSender::default());
    let sender_for_context = Arc::clone(&callback_sender);
    let (app_router, _) = build_test_app_with(move |operation_context| {
        operation_context.with_status_callback_sender(sender_for_context)
    });
    let instant_profile = json!({ "sms_simulation_profile": "instant" });
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&instant_profile),
    )
    .await;
    (app_router, callback_sender)
}

async fn post_form(app_router: &axum::Router, path: &str, form_body: &str) -> u16 {
    let request = Request::post(path)
        .header("content-type", "application/x-www-form-urlencoded")
        .body(Body::from(form_body.to_owned()))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"))
        .status()
        .as_u16()
}

fn read_form(callback_request: &RecordedHttpRequest) -> Value {
    let pairs: Vec<(String, String)> =
        serde_urlencoded::from_str(&callback_request.body).unwrap_or_default();
    Value::Object(
        pairs
            .into_iter()
            .map(|(name, value)| (name, Value::from(value)))
            .collect(),
    )
}

// AC: SM-08.1
// AC: SM-08.2
#[tokio::test]
async fn twilio_callbacks_come_in_status_order_as_signed_forms() {
    let (app_router, callback_sender) = build_app_with_recorder().await;
    let form_body = format!(
        "To=%2B8801700000000&From=%2B15005550006&Body=Hi&StatusCallback={}",
        CALLBACK_URL.replace(':', "%3A").replace('/', "%2F")
    );

    let status = post_form(
        &app_router,
        "/providers/twilio/2010-04-01/Accounts/AC11111111111111111111111111111111/Messages.json",
        &form_body,
    )
    .await;
    let callback_requests = callback_sender.wait_for_requests(3).await;

    let callback_forms: Vec<Value> = callback_requests.iter().map(read_form).collect();
    assert_eq!(status, 201);
    assert_eq!(
        callback_forms
            .iter()
            .map(|form| form["MessageStatus"].clone())
            .collect::<Vec<_>>(),
        vec![json!("queued"), json!("sent"), json!("delivered")]
    );
    assert_eq!(
        callback_forms[0]["AccountSid"],
        "AC11111111111111111111111111111111"
    );
    assert_eq!(callback_forms[0]["To"], "+8801700000000");
    for (callback_request, callback_form) in callback_requests.iter().zip(&callback_forms) {
        assert_eq!(
            callback_request.headers["Content-Type"],
            "application/x-www-form-urlencoded"
        );
        assert_eq!(
            callback_request.headers["X-Twilio-Signature"],
            sign_twilio_request(CALLBACK_URL, callback_form, TWILIO_AUTH_TOKEN)
        );
    }
}

// AC: SM-04.3
// AC: SM-08.1
#[tokio::test]
async fn vonage_delivery_receipts_use_vonages_format_and_status_names() {
    let (app_router, callback_sender) = build_app_with_recorder().await;
    let form_body = format!(
        "from=AcmeInc&to=447700900000&text=Hi&api_key=k&api_secret=s&callback={}",
        CALLBACK_URL.replace(':', "%3A").replace('/', "%2F")
    );

    let status = post_form(&app_router, "/providers/vonage/sms/json", &form_body).await;
    let callback_requests = callback_sender.wait_for_requests(2).await;

    let receipts: Vec<Value> = callback_requests
        .iter()
        .map(|callback_request| serde_json::from_str(&callback_request.body).unwrap_or(Value::Null))
        .collect();
    assert_eq!(status, 200);
    assert_eq!(
        receipts
            .iter()
            .map(|receipt| receipt["status"].clone())
            .collect::<Vec<_>>(),
        vec![json!("accepted"), json!("delivered")]
    );
    assert_eq!(receipts[1]["msisdn"], "447700900000");
    assert_eq!(receipts[1]["err-code"], "0");
    assert_eq!(
        callback_requests[0].headers["Content-Type"],
        "application/json"
    );
}
