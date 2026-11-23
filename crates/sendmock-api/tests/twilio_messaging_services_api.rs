#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const MESSAGES_PATH: &str =
    "/providers/twilio/2010-04-01/Accounts/ACtest0000000000000000000000000000/Messages.json";
const SERVICES_PATH: &str = "/providers/twilio/v1/Services";

async fn call_form(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    form_body: &str,
) -> (u16, Value) {
    let request = Request::builder()
        .method(method)
        .uri(path)
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

async fn register_pool(app_router: &axum::Router, e164_number: &str) -> String {
    let number_input = json!({
        "number": e164_number, "label": "Pool", "channels": ["sms"], "inbound_url": null,
        "inbound_method": "POST", "inbound_fallback_url": null, "inbound_template_id": null,
        "status_callback_url": null, "messaging_service_sid": null,
    });
    let (_, created_number) =
        call_api(app_router, "POST", "/api/v1/numbers", Some(&number_input)).await;
    let service_input = json!({
        "friendly_name": "Notifications", "number_ids": [created_number["id"]],
        "inbound_mode": "defer_to_sender", "inbound_url": null, "inbound_fallback_url": null,
    });
    let (_, created_service) = call_api(
        app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&service_input),
    )
    .await;
    created_service["sid"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

// AC: SM-03.1
#[tokio::test]
async fn a_send_through_a_service_picks_a_sender_from_its_pool() {
    let (app_router, _) = build_test_app();
    let service_sid = register_pool(&app_router, "+15557770001").await;

    let (status, created_message) = call_form(
        &app_router,
        "POST",
        MESSAGES_PATH,
        &format!("To=%2B8801700000000&MessagingServiceSid={service_sid}&Body=Hi"),
    )
    .await;
    let (_, stored_messages) = call_api(&app_router, "GET", "/api/v1/sms", None).await;

    assert_eq!(status, 201);
    assert_eq!(created_message["from"], "+15557770001");
    assert_eq!(created_message["status"], "accepted");
    assert_eq!(
        created_message["messaging_service_sid"],
        service_sid.as_str()
    );
    assert_eq!(stored_messages["items"][0]["from_number"], "+15557770001");
}

// AC: SM-03.2
#[tokio::test]
async fn an_unknown_service_is_created_leniently_and_refused_in_strict_mode() {
    let (app_router, _) = build_test_app();
    let unknown_sid = "MG11111111111111111111111111111111";
    let send_form = format!("To=%2B8801700000000&MessagingServiceSid={unknown_sid}&Body=Hi");

    let (lenient_status, lenient_message) =
        call_form(&app_router, "POST", MESSAGES_PATH, &send_form).await;
    let (_, services) = call_api(&app_router, "GET", "/api/v1/messaging-services", None).await;
    let strict_mode = json!({ "is_strict_twilio_test_mode": true });
    call_api(&app_router, "PATCH", "/api/v1/settings", Some(&strict_mode)).await;
    let other_form = send_form.replace(unknown_sid, "MG22222222222222222222222222222222");
    let (strict_status, strict_error) =
        call_form(&app_router, "POST", MESSAGES_PATH, &other_form).await;

    assert_eq!(lenient_status, 201);
    assert_eq!(lenient_message["from"], "+15005550006");
    assert_eq!(services[0]["sid"], unknown_sid);
    assert_eq!(strict_status, 400);
    assert_eq!(strict_error["code"], 21701);
    assert_eq!(
        strict_error["message"],
        "The Messaging Service Sid MG22222222222222222222222222222222 is invalid."
    );
}

// AC: SM-22.7
#[tokio::test]
async fn a_service_made_without_numbers_sends_from_the_test_sender_and_gets_21704_in_strict_mode() {
    let (app_router, _) = build_test_app();
    let empty_service_sid = "MG33333333333333333333333333333333";
    let send_form = format!("To=%2B8801700000000&MessagingServiceSid={empty_service_sid}&Body=Hi");

    let (create_status, created_service) = call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&json!({
            "sid": empty_service_sid, "friendly_name": "Shop", "inbound_mode": "defer_to_sender",
            "inbound_url": null, "inbound_fallback_url": null,
        })),
    )
    .await;
    let (lenient_status, lenient_message) =
        call_form(&app_router, "POST", MESSAGES_PATH, &send_form).await;
    let strict_mode = json!({ "is_strict_twilio_test_mode": true });
    call_api(&app_router, "PATCH", "/api/v1/settings", Some(&strict_mode)).await;
    let (strict_status, strict_error) =
        call_form(&app_router, "POST", MESSAGES_PATH, &send_form).await;

    assert_eq!(create_status, 201, "{created_service}");
    assert_eq!(created_service["number_ids"], json!([]));
    assert_eq!(lenient_status, 201, "{lenient_message}");
    assert_eq!(lenient_message["from"], "+15005550006");
    assert_eq!(strict_status, 400, "{strict_error}");
    assert_eq!(strict_error["code"], 21704);
    assert_eq!(
        strict_error["message"],
        "The Messaging Service contains no phone numbers"
    );
}

// AC: SM-22.9
#[tokio::test]
async fn a_service_made_from_only_a_name_takes_a_new_services_defaults() {
    let (app_router, _) = build_test_app();

    let (create_status, created_service) = call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&json!({ "friendly_name": "Clinic" })),
    )
    .await;

    assert_eq!(create_status, 201, "{created_service}");
    assert_eq!(created_service["friendly_name"], "Clinic");
    assert_eq!(created_service["inbound_mode"], "defer_to_sender");
    assert_eq!(created_service["inbound_url"], Value::Null);
    assert_eq!(created_service["inbound_fallback_url"], Value::Null);
    assert_eq!(created_service["number_ids"], json!([]));
    assert_eq!(created_service["opt_out_keywords"], true);
}

// AC: SM-03.3
#[tokio::test]
async fn twilios_services_api_creates_lists_fetches_and_deletes_services() {
    let (app_router, _) = build_test_app();

    let (create_status, created_service) = call_form(
        &app_router,
        "POST",
        SERVICES_PATH,
        "FriendlyName=Alerts&InboundRequestUrl=https%3A%2F%2Fapp.test%2Fin",
    )
    .await;
    let service_path = format!(
        "{SERVICES_PATH}/{}",
        created_service["sid"].as_str().unwrap_or_default()
    );
    let (_, service_page) = call_form(&app_router, "GET", SERVICES_PATH, "").await;
    let (fetch_status, fetched_service) = call_form(&app_router, "GET", &service_path, "").await;
    let (_, native_services) =
        call_api(&app_router, "GET", "/api/v1/messaging-services", None).await;
    let (delete_status, _) = call_form(&app_router, "DELETE", &service_path, "").await;
    let (gone_status, gone_error) = call_form(&app_router, "GET", &service_path, "").await;
    let (missing_name_status, missing_name_error) =
        call_form(&app_router, "POST", SERVICES_PATH, "").await;

    assert_eq!(create_status, 201);
    assert!(
        created_service["sid"]
            .as_str()
            .is_some_and(|sid| sid.starts_with("MG") && sid.len() == 34)
    );
    assert_eq!(
        created_service["inbound_request_url"],
        "https://app.test/in"
    );
    assert_eq!(service_page["services"][0]["sid"], created_service["sid"]);
    assert_eq!(service_page["meta"]["key"], "services");
    assert_eq!(
        (fetch_status, fetched_service["friendly_name"].clone()),
        (200, json!("Alerts"))
    );
    assert_eq!(native_services[0]["inbound_mode"], "webhook");
    assert_eq!(delete_status, 204);
    assert_eq!(
        (gone_status, gone_error["code"].clone()),
        (404, json!(20404))
    );
    assert_eq!(
        (missing_name_status, missing_name_error["code"].clone()),
        (400, json!(20001))
    );
}
