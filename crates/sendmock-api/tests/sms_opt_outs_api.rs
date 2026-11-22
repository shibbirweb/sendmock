#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const APP_NUMBER: &str = "+15550001111";
const CONTACT_NUMBER: &str = "+15550002222";
const OTHER_CONTACT: &str = "+15550003333";
const TWILIO_MESSAGES_PATH: &str =
    "/providers/twilio/2010-04-01/Accounts/ACtest00000000000000000000000000/Messages.json";

/// A send through the Twilio API; answers its status and body.
async fn send_through_twilio(app_router: &axum::Router, form_body: &str) -> (u16, Value) {
    let request = Request::builder()
        .method("POST")
        .uri(TWILIO_MESSAGES_PATH)
        .header("content-type", "application/x-www-form-urlencoded")
        .body(Body::from(form_body.to_owned()))
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

fn form_send(from_field: &str, to_number: &str) -> String {
    format!(
        "{from_field}&To={}&Body=Your%20order%20shipped",
        to_number.replace('+', "%2B")
    )
}

fn from_app_number() -> String {
    format!("From={}", APP_NUMBER.replace('+', "%2B"))
}

async fn text_app(app_router: &axum::Router, from_number: &str, body: &str) {
    let (status, created) = call_api(
        app_router,
        "POST",
        "/api/v1/sms/inbound",
        Some(&json!({ "from": from_number, "to": APP_NUMBER, "body": body })),
    )
    .await;
    assert_eq!(status, 201, "{created}");
}

async fn register_app_number(app_router: &axum::Router) -> Value {
    let (status, created) = call_api(
        app_router,
        "POST",
        "/api/v1/numbers",
        Some(&json!({
            "number": APP_NUMBER, "label": "Shop", "channels": ["sms"],
            "inbound_url": null, "inbound_fallback_url": null,
            "inbound_template_id": "twilio.inbound_sms", "status_callback_url": null,
            "messaging_service_sid": null,
        })),
    )
    .await;
    assert_eq!(status, 201, "{created}");
    created
}

// AC: SM-23.1
#[tokio::test]
async fn stop_blocks_later_sends_with_21610_and_start_lifts_it() {
    let (app_router, _) = build_test_app();
    register_app_number(&app_router).await;

    text_app(&app_router, CONTACT_NUMBER, "Stop").await;
    let (blocked_status, blocked) =
        send_through_twilio(&app_router, &form_send(&from_app_number(), CONTACT_NUMBER)).await;
    let (other_status, _) =
        send_through_twilio(&app_router, &form_send(&from_app_number(), OTHER_CONTACT)).await;
    text_app(&app_router, CONTACT_NUMBER, "START").await;
    let (lifted_status, lifted) =
        send_through_twilio(&app_router, &form_send(&from_app_number(), CONTACT_NUMBER)).await;

    assert_eq!(blocked_status, 400, "{blocked}");
    assert_eq!(blocked["code"], 21610, "{blocked}");
    assert_eq!(other_status, 201);
    assert_eq!(lifted_status, 201, "{lifted}");
}

// AC: SM-23.1
#[tokio::test]
async fn a_stop_to_a_pooled_number_blocks_the_whole_messaging_service() {
    let (app_router, _) = build_test_app();
    let app_number = register_app_number(&app_router).await;
    let (_, messaging_service) = call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&json!({
            "friendly_name": "Notifications", "number_ids": [app_number["id"]],
            "inbound_mode": "defer_to_sender", "inbound_url": null, "inbound_fallback_url": null,
        })),
    )
    .await;
    let service_sid = messaging_service["sid"].as_str().unwrap_or_default();

    text_app(&app_router, CONTACT_NUMBER, "unsubscribe").await;
    let (_, opt_outs) = call_api(&app_router, "GET", "/api/v1/sms/opt-outs", None).await;
    let (blocked_status, blocked) = send_through_twilio(
        &app_router,
        &form_send(
            &format!("MessagingServiceSid={service_sid}"),
            CONTACT_NUMBER,
        ),
    )
    .await;

    assert_eq!(opt_outs[0]["sender"], service_sid, "{opt_outs}");
    assert_eq!(opt_outs[0]["contact_number"], CONTACT_NUMBER);
    assert_eq!(blocked_status, 400, "{blocked}");
    assert_eq!(blocked["code"], 21610);
}

// AC: SM-23.2
#[tokio::test]
async fn auto_replies_answer_stop_as_twilio_does() {
    let (app_router, _) = build_test_app();
    register_app_number(&app_router).await;
    let (patch_status, patched) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/sms/providers/twilio",
        Some(&json!({ "opt_out_auto_replies": true })),
    )
    .await;
    assert_eq!(patch_status, 200, "{patched}");

    text_app(&app_router, CONTACT_NUMBER, "STOP").await;
    let (_, sms_page) = call_api(&app_router, "GET", "/api/v1/sms?direction=outbound", None).await;

    let reply = &sms_page["items"][0];
    assert_eq!(reply["from_number"], APP_NUMBER, "{sms_page}");
    assert_eq!(reply["to_number"], CONTACT_NUMBER);
    assert!(
        reply["body"]
            .as_str()
            .unwrap_or_default()
            .starts_with("You have successfully been unsubscribed."),
        "{reply}"
    );
}

// AC: SM-23.3
#[tokio::test]
async fn opt_outs_are_listed_lifted_one_by_one_and_cleared() {
    let (app_router, _) = build_test_app();
    register_app_number(&app_router).await;
    text_app(&app_router, CONTACT_NUMBER, "STOP").await;
    text_app(&app_router, OTHER_CONTACT, "QUIT").await;

    let (_, listed) = call_api(&app_router, "GET", "/api/v1/sms/opt-outs", None).await;
    let (lift_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!(
            "/api/v1/sms/opt-outs/{}/{}",
            "%2B15550001111", "%2B15550002222"
        ),
        None,
    )
    .await;
    let (missing_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!(
            "/api/v1/sms/opt-outs/{}/{}",
            "%2B15550001111", "%2B15550002222"
        ),
        None,
    )
    .await;
    let (clear_status, _) = call_api(&app_router, "DELETE", "/api/v1/sms/opt-outs", None).await;
    let (_, cleared) = call_api(&app_router, "GET", "/api/v1/sms/opt-outs", None).await;

    assert_eq!(listed.as_array().map(Vec::len), Some(2), "{listed}");
    assert_eq!(lift_status, 204);
    assert_eq!(missing_status, 404);
    assert_eq!(clear_status, 204);
    assert_eq!(cleared, json!([]));
}

// AC: SM-23.3
#[tokio::test]
async fn with_the_providers_switch_off_stop_is_an_ordinary_text() {
    let (app_router, _) = build_test_app();
    register_app_number(&app_router).await;
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/sms/providers/twilio",
        Some(&json!({ "opt_out_keywords": false })),
    )
    .await;

    text_app(&app_router, CONTACT_NUMBER, "STOP").await;
    let (_, listed) = call_api(&app_router, "GET", "/api/v1/sms/opt-outs", None).await;
    let (send_status, _) =
        send_through_twilio(&app_router, &form_send(&from_app_number(), CONTACT_NUMBER)).await;

    assert_eq!(listed, json!([]));
    assert_eq!(send_status, 201);
}

// AC: SM-23.3
#[tokio::test]
async fn a_number_or_a_messaging_service_with_opt_out_keywords_off_ignores_stop() {
    let (app_router, _) = build_test_app();
    let app_number = register_app_number(&app_router).await;
    let number_path = format!(
        "/api/v1/numbers/{}",
        app_number["id"].as_str().unwrap_or_default()
    );
    let (number_status, number_off) = call_api(
        &app_router,
        "PATCH",
        &number_path,
        Some(&json!({ "opt_out_keywords": false })),
    )
    .await;
    text_app(&app_router, CONTACT_NUMBER, "STOP").await;
    let (_, after_number_off) = call_api(&app_router, "GET", "/api/v1/sms/opt-outs", None).await;

    call_api(
        &app_router,
        "PATCH",
        &number_path,
        Some(&json!({ "opt_out_keywords": true })),
    )
    .await;
    call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&json!({
            "friendly_name": "Quiet", "number_ids": [app_number["id"]],
            "inbound_mode": "defer_to_sender", "inbound_url": null, "inbound_fallback_url": null,
            "opt_out_keywords": false,
        })),
    )
    .await;
    text_app(&app_router, CONTACT_NUMBER, "STOP").await;
    let (_, after_service_off) = call_api(&app_router, "GET", "/api/v1/sms/opt-outs", None).await;

    assert_eq!(number_status, 200, "{number_off}");
    assert_eq!(number_off["opt_out_keywords"], false);
    assert_eq!(after_number_off, json!([]));
    assert_eq!(after_service_off, json!([]));
}
