#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const VERIFY_PATH: &str = "/providers/vonage_verify/v2/verify";

async fn start_verification(
    app_router: &axum::Router,
    channel: &str,
    recipient: &str,
) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        VERIFY_PATH,
        Some(&json!({
            "brand": "Shop",
            "code_length": 6,
            "workflow": [{ "channel": channel, "to": recipient }],
        })),
    )
    .await
}

async fn start_sms_verification(app_router: &axum::Router) -> String {
    let (status, started) = start_verification(app_router, "sms", "447700900001").await;
    assert_eq!(status, 202, "{started}");
    started["request_id"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

async fn read_verification(app_router: &axum::Router, request_id: &str) -> Value {
    let (status, verification) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/verify/{request_id}"),
        None,
    )
    .await;
    assert_eq!(status, 200, "{verification}");
    verification
}

async fn check_code(app_router: &axum::Router, request_id: &str, code: &str) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        &format!("{VERIFY_PATH}/{request_id}"),
        Some(&json!({ "code": code })),
    )
    .await
}

fn problem_type(problem: &Value) -> &str {
    problem["type"].as_str().unwrap_or_default()
}

// AC: VF-05.1
#[tokio::test]
async fn an_sms_workflow_starts_a_verification_and_delivers_its_code_by_sms() {
    let (app_router, _) = build_test_app();

    let request_id = start_sms_verification(&app_router).await;
    let verification = read_verification(&app_router, &request_id).await;
    let sms_path = format!(
        "/api/v1/sms/{}",
        verification["linked_message_id"]
            .as_str()
            .unwrap_or_default()
    );
    let (_, code_sms) = call_api(&app_router, "GET", &sms_path, None).await;

    let code = verification["code"].as_str().unwrap_or_default();
    assert_eq!(code.len(), 6);
    assert_eq!(verification["status"], "pending");
    assert_eq!(code_sms["to"], "+447700900001");
    assert_eq!(
        code_sms["body"],
        format!("Your Shop verification code is: {code}")
    );
}

// AC: VF-05.1
#[tokio::test]
async fn an_email_workflow_delivers_the_code_by_email() {
    let (app_router, _) = build_test_app();

    let (status, started) = start_verification(&app_router, "email", "sam@example.test").await;
    let (_, emails) = call_api(&app_router, "GET", "/api/v1/emails", None).await;

    assert_eq!(status, 202, "{started}");
    assert_eq!(emails["items"][0]["subject"], "Your Shop verification code");
}

// AC: VF-05.1
#[tokio::test]
async fn a_start_without_a_workflow_is_refused_as_invalid_params() {
    let (app_router, _) = build_test_app();

    let (status, problem) = call_api(
        &app_router,
        "POST",
        VERIFY_PATH,
        Some(&json!({ "brand": "Shop" })),
    )
    .await;
    let (channel_status, _) = start_verification(&app_router, "pigeon", "447700900001").await;

    assert_eq!((status, channel_status), (422, 422));
    assert_eq!(problem["title"], "Invalid params");
    assert!(
        problem_type(&problem).ends_with("#invalid-params"),
        "{problem}"
    );
    assert!(problem["instance"].as_str().is_some(), "{problem}");
}

// AC: VF-05.2
#[tokio::test]
async fn the_right_code_completes_and_a_wrong_one_is_an_invalid_code() {
    let (app_router, _) = build_test_app();
    let request_id = start_sms_verification(&app_router).await;
    let verification = read_verification(&app_router, &request_id).await;
    let code = verification["code"].as_str().unwrap_or_default();

    let (wrong_status, wrong_problem) = check_code(&app_router, &request_id, "000000").await;
    let (right_status, completed) = check_code(&app_router, &request_id, code).await;

    assert_eq!(wrong_status, 400);
    assert_eq!(wrong_problem["title"], "Invalid Code");
    assert!(
        problem_type(&wrong_problem).ends_with("#invalid-code"),
        "{wrong_problem}"
    );
    assert_eq!(right_status, 200);
    assert_eq!(
        completed,
        json!({ "request_id": request_id, "status": "completed" })
    );
}

// AC: VF-05.2
#[tokio::test]
async fn a_finished_or_unknown_request_is_not_found() {
    let (app_router, _) = build_test_app();
    let request_id = start_sms_verification(&app_router).await;
    let verification = read_verification(&app_router, &request_id).await;
    let code = verification["code"].as_str().unwrap_or_default();
    check_code(&app_router, &request_id, code).await;

    let (finished_status, finished_problem) = check_code(&app_router, &request_id, code).await;
    let (unknown_status, unknown_problem) =
        check_code(&app_router, "c11236f4-00bf-4b89-84ba-88b25df97315", "1234").await;

    assert_eq!((finished_status, unknown_status), (404, 404));
    assert_eq!(finished_problem["title"], "Not Found");
    assert!(
        problem_type(&unknown_problem).ends_with("#not-found"),
        "{unknown_problem}"
    );
}

// AC: VF-05.3 VF-05.2
#[tokio::test]
async fn a_cancelled_verification_is_finished_and_no_longer_checkable() {
    let (app_router, _) = build_test_app();
    let request_id = start_sms_verification(&app_router).await;

    let (cancel_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("{VERIFY_PATH}/{request_id}"),
        None,
    )
    .await;
    let verification = read_verification(&app_router, &request_id).await;
    let code = verification["code"].as_str().unwrap_or_default();
    let (check_status, _) = check_code(&app_router, &request_id, code).await;
    let (cancel_again_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("{VERIFY_PATH}/{request_id}"),
        None,
    )
    .await;

    assert_eq!(cancel_status, 204);
    assert_eq!(verification["status"], "canceled");
    assert_eq!((check_status, cancel_again_status), (404, 404));
}

// AC: VF-05.3
#[tokio::test]
async fn every_verification_shows_under_a_service_named_after_its_brand() {
    let (app_router, _) = build_test_app();
    let first_request_id = start_sms_verification(&app_router).await;
    let (status, _) = start_verification(&app_router, "email", "sam@example.test").await;
    assert_eq!(status, 202);

    let (_, services) = call_api(&app_router, "GET", "/api/v1/verify/services", None).await;
    let first_verification = read_verification(&app_router, &first_request_id).await;

    let brand_services: Vec<&Value> = services
        .as_array()
        .into_iter()
        .flatten()
        .filter(|service| service["friendly_name"] == "Shop")
        .collect();
    assert_eq!(brand_services.len(), 1, "{services}");
    assert_eq!(brand_services[0]["code_length"], 6);
    assert_eq!(first_verification["service_name"], "Shop");
    assert_eq!(first_verification["service_sid"], brand_services[0]["sid"]);
}
