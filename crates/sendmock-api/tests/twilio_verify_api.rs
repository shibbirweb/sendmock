#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const SERVICES_PATH: &str = "/providers/twilio_verify/v2/Services";

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

async fn create_service(app_router: &axum::Router) -> String {
    let (status, created_service) = call_form(
        app_router,
        "POST",
        SERVICES_PATH,
        "FriendlyName=Shop&CodeLength=6",
    )
    .await;
    assert_eq!(status, 201, "{created_service}");
    created_service["sid"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

async fn start(app_router: &axum::Router, service_sid: &str, form_body: &str) -> (u16, Value) {
    call_form(
        app_router,
        "POST",
        &format!("{SERVICES_PATH}/{service_sid}/Verifications"),
        form_body,
    )
    .await
}

async fn check(app_router: &axum::Router, service_sid: &str, form_body: &str) -> (u16, Value) {
    call_form(
        app_router,
        "POST",
        &format!("{SERVICES_PATH}/{service_sid}/VerificationCheck"),
        form_body,
    )
    .await
}

async fn read_code(app_router: &axum::Router, recipient: &str) -> String {
    let otp_path = format!(
        "/api/v1/otp?to={}&channel=verify",
        recipient.replace('+', "%2B").replace('@', "%40")
    );
    call_api(app_router, "GET", &otp_path, None).await.1["code"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

// AC: VF-01.1
#[tokio::test]
async fn a_service_is_created_and_fetched_in_twilios_shape() {
    let (app_router, _) = build_test_app();

    let service_sid = create_service(&app_router).await;
    let (fetch_status, fetched_service) = call_form(
        &app_router,
        "GET",
        &format!("{SERVICES_PATH}/{service_sid}"),
        "",
    )
    .await;
    let (bad_length_status, bad_length_error) = call_form(
        &app_router,
        "POST",
        SERVICES_PATH,
        "FriendlyName=Shop&CodeLength=12",
    )
    .await;

    assert!(service_sid.starts_with("VA") && service_sid.len() == 34);
    assert_eq!(fetch_status, 200);
    assert_eq!(fetched_service["friendly_name"], "Shop");
    assert_eq!(fetched_service["code_length"], 6);
    assert_eq!(
        fetched_service["url"],
        format!("https://verify.twilio.com/v2/Services/{service_sid}")
    );
    assert_eq!(
        (bad_length_status, bad_length_error["code"].clone()),
        (400, json!(60200))
    );
}

// AC: VF-02.1
// AC: VF-03.1
// AC: VF-03.4
#[tokio::test]
async fn an_otp_login_starts_pending_and_is_approved_by_the_right_code() {
    let (app_router, _) = build_test_app();
    let service_sid = create_service(&app_router).await;

    let (start_status, started) =
        start(&app_router, &service_sid, "To=%2B14155550100&Channel=sms").await;
    let (wrong_status, wrong_check) =
        check(&app_router, &service_sid, "To=%2B14155550100&Code=000000").await;
    let code = read_code(&app_router, "+14155550100").await;
    let (right_status, right_check) = check(
        &app_router,
        &service_sid,
        &format!("To=%2B14155550100&Code={code}"),
    )
    .await;

    assert_eq!(start_status, 201);
    assert!(
        started["sid"]
            .as_str()
            .is_some_and(|sid| sid.starts_with("VE"))
    );
    assert_eq!(started["status"], "pending");
    assert_eq!(started["valid"], false);
    assert_eq!(started["channel"], "sms");
    assert_eq!(
        started["send_code_attempts"].as_array().map(Vec::len),
        Some(1)
    );
    assert_eq!(
        (
            wrong_status,
            wrong_check["status"].clone(),
            wrong_check["valid"].clone()
        ),
        (200, json!("pending"), json!(false))
    );
    assert_eq!(
        (
            right_status,
            right_check["status"].clone(),
            right_check["valid"].clone()
        ),
        (200, json!("approved"), json!(true))
    );
}

// AC: VF-02.2
#[tokio::test]
async fn the_email_channel_captures_an_email_and_call_captures_nothing() {
    let (app_router, _) = build_test_app();
    let service_sid = create_service(&app_router).await;

    start(
        &app_router,
        &service_sid,
        "To=sam%40example.test&Channel=email",
    )
    .await;
    let (call_status, _) = start(&app_router, &service_sid, "To=%2B14155550199&Channel=call").await;
    let (_, emails) = call_api(&app_router, "GET", "/api/v1/emails", None).await;
    let (_, verifications) =
        call_api(&app_router, "GET", "/api/v1/verify?channel=call", None).await;

    assert_eq!(emails["items"][0]["subject"], "Your Shop verification code");
    assert_eq!(call_status, 201);
    assert_eq!(verifications["items"][0]["linked_message_id"], Value::Null);
    assert!(!read_code(&app_router, "sam@example.test").await.is_empty());
}

// AC: VF-02.3
#[tokio::test]
async fn a_fixed_code_is_always_sent() {
    let (app_router, _) = build_test_app();
    let fixed_service = json!({ "friendly_name": "Shop", "code_length": 6, "fixed_code": "123456", "ttl_seconds": 600 });
    let (_, created_service) = call_api(
        &app_router,
        "POST",
        "/api/v1/verify/services",
        Some(&fixed_service),
    )
    .await;
    let service_sid = created_service["sid"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    start(&app_router, &service_sid, "To=%2B14155550100&Channel=sms").await;
    let (_, approved) = check(&app_router, &service_sid, "To=%2B14155550100&Code=123456").await;

    assert_eq!(approved["status"], "approved");
}

// AC: VF-02.5
#[tokio::test]
async fn the_sixth_send_to_a_recipient_is_refused_with_60203() {
    let (app_router, _) = build_test_app();
    let service_sid = create_service(&app_router).await;

    for _ in 0..5 {
        let (status, _) = start(&app_router, &service_sid, "To=%2B14155550100&Channel=sms").await;
        assert_eq!(status, 201);
    }
    let (status, error_body) =
        start(&app_router, &service_sid, "To=%2B14155550100&Channel=sms").await;

    assert_eq!((status, error_body["code"].clone()), (429, json!(60203)));
}

// AC: VF-03.2
#[tokio::test]
async fn the_fifth_wrong_code_fails_with_60202() {
    let (app_router, _) = build_test_app();
    let service_sid = create_service(&app_router).await;
    start(&app_router, &service_sid, "To=%2B14155550100&Channel=sms").await;

    for _ in 0..4 {
        let (_, wrong_check) =
            check(&app_router, &service_sid, "To=%2B14155550100&Code=000000").await;
        assert_eq!(wrong_check["status"], "pending");
    }
    let (status, error_body) =
        check(&app_router, &service_sid, "To=%2B14155550100&Code=000000").await;

    assert_eq!((status, error_body["code"].clone()), (429, json!(60202)));
}

// AC: VF-03.3
#[tokio::test]
async fn expired_canceled_and_unknown_verifications_answer_20404() {
    let (app_router, _) = build_test_app();
    let service_sid = create_service(&app_router).await;
    let (_, started) = start(&app_router, &service_sid, "To=%2B14155550100&Channel=sms").await;
    let verification_sid = started["sid"].as_str().unwrap_or_default();
    let force_path = format!("/api/v1/verify/{verification_sid}/force");

    let (unknown_status, unknown_error) = check(
        &app_router,
        &service_sid,
        "VerificationSid=VE00000000000000000000000000000000&Code=1",
    )
    .await;
    call_api(
        &app_router,
        "POST",
        &force_path,
        Some(&json!({ "state": "expired" })),
    )
    .await;
    let (expired_status, _) = check(
        &app_router,
        &service_sid,
        &format!("VerificationSid={verification_sid}&Code=1"),
    )
    .await;
    let (fetch_status, _) = call_form(
        &app_router,
        "GET",
        &format!("{SERVICES_PATH}/{service_sid}/Verifications/{verification_sid}"),
        "",
    )
    .await;

    assert_eq!(
        (unknown_status, unknown_error["code"].clone()),
        (404, json!(20404))
    );
    assert_eq!(expired_status, 404);
    assert_eq!(fetch_status, 404);
}

#[tokio::test]
async fn the_app_can_cancel_a_verification_and_bad_params_get_60200() {
    let (app_router, _) = build_test_app();
    let service_sid = create_service(&app_router).await;
    let (_, started) = start(&app_router, &service_sid, "To=%2B14155550100&Channel=sms").await;
    let verification_path = format!(
        "{SERVICES_PATH}/{service_sid}/Verifications/{}",
        started["sid"].as_str().unwrap_or_default()
    );

    let (cancel_status, canceled) =
        call_form(&app_router, "POST", &verification_path, "Status=canceled").await;
    let (missing_to_status, missing_to_error) =
        start(&app_router, &service_sid, "Channel=sms").await;
    let (bad_channel_status, _) =
        start(&app_router, &service_sid, "To=%2B14155550100&Channel=fax").await;

    assert_eq!(
        (cancel_status, canceled["status"].clone()),
        (200, json!("canceled"))
    );
    assert_eq!(
        (missing_to_status, missing_to_error["code"].clone()),
        (400, json!(60200))
    );
    assert_eq!(bad_channel_status, 400);
}
