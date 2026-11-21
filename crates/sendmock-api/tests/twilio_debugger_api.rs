#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod recording_callback_sender;
    pub mod test_app;
}

use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sendmock_ops::{RecordedHttpRequest, sign_twilio_request};
use serde_json::{Value, json};
use support::recording_callback_sender::RecordingCallbackSender;
use support::test_app::{build_test_app, build_test_app_with, call_api};
use tower::ServiceExt;

const MAIN_ACCOUNT_SID: &str = "ACtest00000000000000000000000000";
const SUBACCOUNT_SID: &str = "AC22222222222222222222222222222222";
const SUBACCOUNT_TOKEN: &str = "clinic-token-5150";
const DEBUGGER_URL: &str = "http://127.0.0.1:9/twilio/debugger";
const CALLBACK_URL: &str = "http://127.0.0.1:9/sms/status";
const TWILIO_DEBUGGER: &str = include_str!("fixtures/provider_webhooks/twilio_debugger.json");

/// An app whose callbacks are recorded, the instant delivery profile, and one subaccount with
/// a Debugger webhook URL.
async fn build_app_with_debugger(
    callback_sender: RecordingCallbackSender,
) -> (axum::Router, Arc<RecordingCallbackSender>) {
    let callback_sender = Arc::new(callback_sender);
    let sender_for_context = Arc::clone(&callback_sender);
    let (app_router, _) = build_test_app_with(move |operation_context| {
        operation_context.with_status_callback_sender(sender_for_context)
    });
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "sms_simulation_profile": "instant" })),
    )
    .await;
    let new_subaccount = json!({
        "account_sid": SUBACCOUNT_SID,
        "friendly_name": "Clinic",
        "auth_token": SUBACCOUNT_TOKEN,
        "debugger_url": DEBUGGER_URL,
    });
    let (status, created) = call_api(
        &app_router,
        "POST",
        "/api/v1/twilio/subaccounts",
        Some(&new_subaccount),
    )
    .await;
    assert_eq!(status, 201, "{created}");
    (app_router, callback_sender)
}

/// Sends under the subaccount with Basic auth; answers the stored message's id.
async fn send_under_subaccount(app_router: &axum::Router, to_number: &str) -> Value {
    let form_body = format!(
        "To={}&From=%2B15005550006&Body=Hi&StatusCallback={}",
        to_number.replace('+', "%2B"),
        CALLBACK_URL.replace(':', "%3A").replace('/', "%2F")
    );
    let request = Request::post(format!(
        "/providers/twilio/2010-04-01/Accounts/{SUBACCOUNT_SID}/Messages.json"
    ))
    .header("content-type", "application/x-www-form-urlencoded")
    .header(
        "authorization",
        format!(
            "Basic {}",
            STANDARD.encode(format!("{SUBACCOUNT_SID}:{SUBACCOUNT_TOKEN}"))
        ),
    )
    .body(Body::from(form_body))
    .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    serde_json::from_slice(&body_bytes).unwrap_or(Value::Null)
}

fn read_form(recorded_request: &RecordedHttpRequest) -> Value {
    let pairs: Vec<(String, String)> =
        serde_urlencoded::from_str(&recorded_request.body).unwrap_or_default();
    Value::Object(
        pairs
            .into_iter()
            .map(|(name, value)| (name, Value::from(value)))
            .collect(),
    )
}

/// Waits for the requests to the Debugger URL among every recorded callback.
async fn wait_for_debugger_events(
    callback_sender: &RecordingCallbackSender,
    total_requests: usize,
) -> Vec<RecordedHttpRequest> {
    callback_sender
        .wait_for_requests(total_requests)
        .await
        .into_iter()
        .filter(|recorded_request| recorded_request.url == DEBUGGER_URL)
        .collect()
}

fn check_against_fixture(debugger_form: &Value) {
    // The shipped provider's test SID is shorter than a real one, which the schema checks.
    let mut debugger_form = debugger_form.clone();
    if debugger_form["ParentAccountSid"] == MAIN_ACCOUNT_SID {
        debugger_form["ParentAccountSid"] = Value::from("AC33333333333333333333333333333333");
    }
    let fixture: Value = serde_json::from_str(TWILIO_DEBUGGER)
        .unwrap_or_else(|error| panic!("a readable fixture: {error}"));
    let validator = jsonschema::draft202012::new(&fixture["schema"])
        .unwrap_or_else(|error| panic!("the fixture schema compiles: {error}"));
    let schema_errors: Vec<String> = validator
        .iter_errors(&fixture["documented_example"])
        .chain(validator.iter_errors(&debugger_form))
        .map(|validation_error| validation_error.to_string())
        .collect();
    assert_eq!(schema_errors, Vec::<String>::new(), "{debugger_form}");
}

// AC: SM-21.1
// AC: SM-21.3
#[tokio::test]
async fn an_undelivered_subaccount_message_sends_one_signed_debugger_event_with_its_error() {
    let (app_router, callback_sender) =
        build_app_with_debugger(RecordingCallbackSender::default()).await;

    let sent_message = send_under_subaccount(&app_router, "+15005550101").await;
    let debugger_events = wait_for_debugger_events(&callback_sender, 4).await;

    assert_eq!(debugger_events.len(), 1);
    let debugger_form = read_form(&debugger_events[0]);
    check_against_fixture(&debugger_form);
    assert_eq!(debugger_form["AccountSid"], SUBACCOUNT_SID);
    assert_eq!(debugger_form["ParentAccountSid"], MAIN_ACCOUNT_SID);
    assert_eq!(
        debugger_events[0].headers["X-Twilio-Signature"],
        sign_twilio_request(DEBUGGER_URL, &debugger_form, SUBACCOUNT_TOKEN)
    );
    let payload: Value =
        serde_json::from_str(debugger_form["Payload"].as_str().unwrap_or_default())
            .unwrap_or(Value::Null);
    assert_eq!(payload["error_code"], "30003");
    assert_eq!(payload["resource_sid"], sent_message["sid"]);
    assert_eq!(payload["more_info"]["LogLevel"], "ERROR");
}

// AC: SM-21.3
#[tokio::test]
async fn a_failed_status_callback_sends_a_debugger_event_with_error_11200_and_the_webhook() {
    let (app_router, callback_sender) =
        build_app_with_debugger(RecordingCallbackSender::answering([Some(500)])).await;

    send_under_subaccount(&app_router, "+8801700000000").await;
    let debugger_events = wait_for_debugger_events(&callback_sender, 4).await;

    assert_eq!(debugger_events.len(), 1);
    let debugger_form = read_form(&debugger_events[0]);
    let payload: Value =
        serde_json::from_str(debugger_form["Payload"].as_str().unwrap_or_default())
            .unwrap_or(Value::Null);
    assert_eq!(payload["error_code"], "11200");
    assert_eq!(payload["webhook"]["request"]["url"], CALLBACK_URL);
    assert_eq!(payload["webhook"]["response"]["status_code"], 500);
}

// AC: SM-21.4
#[tokio::test]
async fn a_debugger_event_shows_on_the_message_timeline_as_a_callback_attempt() {
    let (app_router, callback_sender) =
        build_app_with_debugger(RecordingCallbackSender::default()).await;
    let sent_message = send_under_subaccount(&app_router, "+15005550101").await;
    wait_for_debugger_events(&callback_sender, 4).await;
    let (_, sms_page) = call_api(&app_router, "GET", "/api/v1/sms", None).await;
    let sms_id = sms_page["items"][0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    let (_, sms_detail) =
        call_api(&app_router, "GET", &format!("/api/v1/sms/{sms_id}"), None).await;

    let reported_statuses: Vec<Value> = sms_detail["callback_attempts"]
        .as_array()
        .map(|attempts| {
            attempts
                .iter()
                .map(|attempt| attempt["reported_status"].clone())
                .collect()
        })
        .unwrap_or_default();
    assert_eq!(sms_page["items"][0]["provider_id"], sent_message["sid"]);
    assert!(
        reported_statuses.contains(&json!("debugger")),
        "{reported_statuses:?}"
    );
}

// AC: SM-21.4
#[tokio::test]
async fn the_debugger_template_can_be_picked_for_a_webhook_endpoint() {
    let (app_router, _) = build_test_app();

    let (_, templates) = call_api(&app_router, "GET", "/api/v1/webhooks/templates", None).await;
    let (render_status, rendered) = call_api(
        &app_router,
        "POST",
        "/api/v1/webhooks/templates/twilio.debugger/render",
        Some(&json!({})),
    )
    .await;

    let template_ids: Vec<Value> = templates
        .as_array()
        .map(|listed| {
            listed
                .iter()
                .map(|template| template["id"].clone())
                .collect()
        })
        .unwrap_or_default();
    assert!(template_ids.contains(&json!("twilio.debugger")));
    assert_eq!(render_status, 200, "{rendered}");
    assert_eq!(rendered["errors"], json!([]));
    let body = rendered["body"].as_str().unwrap_or_default();
    assert!(body.starts_with("Sid=NO"), "{body}");
    assert!(body.contains("Level=ERROR"), "{body}");
}

// AC: SM-21.2
#[tokio::test]
async fn the_main_account_and_each_subaccount_have_a_debugger_url() {
    let (app_router, _) = build_test_app();
    let seed_toml = r#"
[[sms.twilio_subaccounts]]
sid = "AC33333333333333333333333333333333"
name = "Seeded clinic"
debugger_url = "http://127.0.0.1:9/seeded/debugger"
"#;

    let (_, twilio_provider) =
        call_api(&app_router, "GET", "/api/v1/sms/providers/twilio", None).await;
    let (apply_status, applied) = call_api(
        &app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": seed_toml })),
    )
    .await;
    let (_, subaccounts) = call_api(&app_router, "GET", "/api/v1/twilio/subaccounts", None).await;

    let credential_names: Vec<Value> = twilio_provider["credentials"]
        .as_array()
        .map(|credentials| {
            credentials
                .iter()
                .map(|credential| credential["name"].clone())
                .collect()
        })
        .unwrap_or_default();
    assert!(
        credential_names.contains(&json!("debugger_url")),
        "{twilio_provider}"
    );
    assert_eq!(apply_status, 200, "{applied}");
    assert_eq!(
        subaccounts[0]["debugger_url"],
        "http://127.0.0.1:9/seeded/debugger"
    );
}
