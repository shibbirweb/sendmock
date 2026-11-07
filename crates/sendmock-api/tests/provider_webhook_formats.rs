#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod recording_callback_sender;
    pub mod test_app;
}

use std::collections::BTreeMap;
use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use sendmock_ops::{RecordedHttpRequest, sign_twilio_request};
use serde_json::{Value, json};
use support::recording_callback_sender::RecordingCallbackSender;
use support::test_app::{build_test_app, build_test_app_with, call_api};
use tower::ServiceExt;

const CALLBACK_URL: &str = "http://127.0.0.1:9/sms/status";
const PREVIEW_URL: &str = "http://localhost:8000/webhooks/preview";
/// The shipped Twilio definition's auth token, which signs its callbacks.
const TWILIO_AUTH_TOKEN: &str = "twilio-test-token";

const TWILIO_STATUS_CALLBACK: &str =
    include_str!("fixtures/provider_webhooks/twilio_status_callback.json");
const TWILIO_INBOUND_SMS: &str = include_str!("fixtures/provider_webhooks/twilio_inbound_sms.json");
const VONAGE_DELIVERY_RECEIPT: &str =
    include_str!("fixtures/provider_webhooks/vonage_delivery_receipt.json");
const VONAGE_INBOUND_SMS: &str = include_str!("fixtures/provider_webhooks/vonage_inbound_sms.json");

/// A provider's documented request: method, content type, an example from its docs and the
/// JSON Schema of its fields, which the example itself must pass.
struct ProviderFormatFixture {
    method: String,
    content_type: String,
    documented_example: Value,
    schema: Value,
}

fn load_fixture(fixture_json: &str) -> ProviderFormatFixture {
    let fixture: Value = serde_json::from_str(fixture_json)
        .unwrap_or_else(|error| panic!("a readable fixture: {error}"));
    ProviderFormatFixture {
        method: fixture["method"].as_str().unwrap_or_default().to_owned(),
        content_type: fixture["content_type"]
            .as_str()
            .unwrap_or_default()
            .to_owned(),
        documented_example: fixture["documented_example"].clone(),
        schema: fixture["schema"].clone(),
    }
}

fn find_schema_errors(fixture: &ProviderFormatFixture, payload: &Value) -> Vec<String> {
    let validator = jsonschema::draft202012::new(&fixture.schema)
        .unwrap_or_else(|error| panic!("the fixture schema compiles: {error}"));
    validator
        .iter_errors(payload)
        .map(|validation_error| validation_error.to_string())
        .collect()
}

/// Reads a body in the encoding its content type names: form fields or JSON.
fn read_payload(content_type: &str, body: &str) -> Value {
    if content_type == "application/json" {
        return serde_json::from_str(body).unwrap_or(Value::Null);
    }
    let form_pairs: Vec<(String, String)> = serde_urlencoded::from_str(body).unwrap_or_default();
    Value::Object(
        form_pairs
            .into_iter()
            .map(|(field_name, field_value)| (field_name, Value::from(field_value)))
            .collect(),
    )
}

/// Checks a request against the fixture and answers its fields.
fn check_request(
    fixture: &ProviderFormatFixture,
    method: &str,
    headers: &BTreeMap<String, String>,
    body: &str,
) -> Value {
    let content_type = headers
        .iter()
        .find(|(header_name, _)| header_name.eq_ignore_ascii_case("content-type"))
        .map(|(_, header_value)| header_value.as_str());
    assert_eq!(method, fixture.method);
    assert_eq!(content_type, Some(fixture.content_type.as_str()));
    let payload = read_payload(&fixture.content_type, body);
    let schema_errors = find_schema_errors(fixture, &payload);
    assert!(schema_errors.is_empty(), "{payload}: {schema_errors:?}");
    payload
}

fn check_recorded_request(
    fixture: &ProviderFormatFixture,
    callback_request: &RecordedHttpRequest,
) -> Value {
    check_request(
        fixture,
        &callback_request.method,
        &callback_request.headers,
        &callback_request.body,
    )
}

async fn post_form(app_router: &axum::Router, path: &str, form_body: String) -> u16 {
    let request = Request::post(path)
        .header("content-type", "application/x-www-form-urlencoded")
        .body(Body::from(form_body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"))
        .status()
        .as_u16()
}

async fn build_instant_app_with_recorder() -> (axum::Router, Arc<RecordingCallbackSender>) {
    let callback_sender = Arc::new(RecordingCallbackSender::default());
    let sender_for_context = Arc::clone(&callback_sender);
    let (app_router, _) = build_test_app_with(move |operation_context| {
        operation_context.with_status_callback_sender(sender_for_context)
    });
    let instant_profile = json!({ "sms_simulation_profile": "instant" });
    let (status, _) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&instant_profile),
    )
    .await;
    assert_eq!(status, 200);
    (app_router, callback_sender)
}

fn encoded_callback_url() -> String {
    CALLBACK_URL.replace(':', "%3A").replace('/', "%2F")
}

// AC: WH-06.1
#[test]
fn every_fixture_accepts_the_example_from_its_providers_docs() {
    for fixture_json in [
        TWILIO_STATUS_CALLBACK,
        TWILIO_INBOUND_SMS,
        VONAGE_DELIVERY_RECEIPT,
        VONAGE_INBOUND_SMS,
    ] {
        let fixture = load_fixture(fixture_json);

        let schema_errors = find_schema_errors(&fixture, &fixture.documented_example);

        assert!(schema_errors.is_empty(), "{schema_errors:?}");
    }
}

// AC: WH-06.1
#[tokio::test]
async fn twilio_status_callbacks_match_twilios_documented_format() {
    let fixture = load_fixture(TWILIO_STATUS_CALLBACK);
    let (app_router, callback_sender) = build_instant_app_with_recorder().await;
    let form_body = format!(
        "To=%2B15005550101&From=%2B15005550006&Body=Hi&StatusCallback={}",
        encoded_callback_url()
    );

    let status = post_form(
        &app_router,
        "/providers/twilio/2010-04-01/Accounts/AC11111111111111111111111111111111/Messages.json",
        form_body,
    )
    .await;
    let callback_requests = callback_sender.wait_for_requests(3).await;

    assert_eq!(status, 201);
    let callback_forms: Vec<Value> = callback_requests
        .iter()
        .map(|callback_request| check_recorded_request(&fixture, callback_request))
        .collect();
    assert_eq!(callback_forms.len(), 3);
    assert_eq!(callback_forms[2]["MessageStatus"], "undelivered");
    assert_eq!(callback_forms[2]["ErrorCode"], "30003");
    assert_eq!(callback_forms[0]["ApiVersion"], "2010-04-01");
    assert_eq!(callback_forms[0]["SmsSid"], callback_forms[0]["MessageSid"]);
    for (callback_request, callback_form) in callback_requests.iter().zip(&callback_forms) {
        assert_eq!(
            callback_request.headers["X-Twilio-Signature"],
            sign_twilio_request(CALLBACK_URL, callback_form, TWILIO_AUTH_TOKEN)
        );
    }
}

// AC: WH-06.1
#[tokio::test]
async fn vonage_delivery_receipts_match_vonages_documented_format() {
    let fixture = load_fixture(VONAGE_DELIVERY_RECEIPT);
    let (app_router, callback_sender) = build_instant_app_with_recorder().await;
    let form_body = format!(
        "from=AcmeInc&to=%2B15005550101&text=Hi&api_key=k&api_secret=s&callback={}",
        encoded_callback_url()
    );

    let status = post_form(&app_router, "/providers/vonage/sms/json", form_body).await;
    let callback_requests = callback_sender.wait_for_requests(2).await;

    assert_eq!(status, 200);
    let receipts: Vec<Value> = callback_requests
        .iter()
        .map(|callback_request| check_recorded_request(&fixture, callback_request))
        .collect();
    assert_eq!(receipts.len(), 2);
    assert_eq!(receipts[0]["status"], "accepted");
    assert_eq!(receipts[0]["err-code"], "0");
    assert_eq!(receipts[1]["status"], "rejected");
    assert_eq!(
        receipts[1]["err-code"], "2",
        "Absent Subscriber, not Twilio's 30003"
    );
    assert_eq!(receipts[1]["msisdn"], "15005550101");
    assert_eq!(receipts[1]["to"], "AcmeInc");
}

async fn render_builtin_template(app_router: &axum::Router, template_id: &str) -> Value {
    let (status, render_result) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/webhooks/templates/{template_id}/render"),
        Some(&json!({})),
    )
    .await;
    assert_eq!(status, 200, "{template_id}: {render_result}");
    render_result
}

fn read_rendered_headers(render_result: &Value) -> BTreeMap<String, String> {
    serde_json::from_value(render_result["headers"].clone()).unwrap_or_default()
}

// AC: WH-06.1
#[tokio::test]
async fn the_twilio_inbound_template_matches_twilios_documented_format() {
    let fixture = load_fixture(TWILIO_INBOUND_SMS);
    let (app_router, _) = build_test_app();

    let render_result = render_builtin_template(&app_router, "twilio.inbound_sms").await;

    let rendered_headers = read_rendered_headers(&render_result);
    let inbound_form = check_request(
        &fixture,
        "POST",
        &rendered_headers,
        render_result["body"].as_str().unwrap_or_default(),
    );
    assert_eq!(render_result["errors"], json!([]));
    assert_eq!(inbound_form["SmsStatus"], "received");
    assert_eq!(inbound_form["NumSegments"], "1");
    assert_eq!(
        rendered_headers.get("X-Twilio-Signature"),
        Some(&sign_twilio_request(PREVIEW_URL, &inbound_form, ""))
    );
}

// AC: WH-06.1
#[tokio::test]
async fn the_vonage_inbound_template_matches_vonages_documented_format() {
    let fixture = load_fixture(VONAGE_INBOUND_SMS);
    let (app_router, _) = build_test_app();

    let render_result = render_builtin_template(&app_router, "vonage.inbound").await;

    let inbound_message = check_request(
        &fixture,
        "POST",
        &read_rendered_headers(&render_result),
        render_result["body"].as_str().unwrap_or_default(),
    );
    assert_eq!(render_result["errors"], json!([]));
    assert_eq!(inbound_message["msisdn"], "15550001111");
    assert_eq!(inbound_message["type"], "text");
    assert_eq!(inbound_message["keyword"], "YOUR");
    assert_eq!(inbound_message["message-timestamp"], "2026-01-01 09:00:00");
}
