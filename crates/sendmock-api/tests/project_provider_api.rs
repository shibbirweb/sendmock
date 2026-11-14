#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod project_requests;
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::project_requests::create_project;
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const ACCOUNT_PATH: &str = "2010-04-01/Accounts/ACtest00000000000000000000000000";
/// `ACtest...:any-token`, as an SDK configured with any credentials sends it.
const ANY_BASIC_AUTH: &str = "Basic QUN0ZXN0MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA6YW55LXRva2Vu";
const TWILIO_SMS_FORM: &str = "To=%2B8801700000000&From=%2B15550001111&Body=Your+code+is+4821";

/// A provider request as an SDK sends it, optionally naming a project in the header.
async fn call_provider(
    router: &axum::Router,
    path: &str,
    (content_type, request_body): (&str, String),
    project_header: Option<&str>,
) -> (u16, Value) {
    let mut request_builder = Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", content_type)
        .header("authorization", ANY_BASIC_AUTH);
    if let Some(project_key) = project_header {
        request_builder = request_builder.header("x-sendmock-project", project_key);
    }
    let request = request_builder
        .body(Body::from(request_body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = router
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

fn twilio_form() -> (&'static str, String) {
    (
        "application/x-www-form-urlencoded",
        TWILIO_SMS_FORM.to_owned(),
    )
}

async fn newest_item(app_router: &axum::Router, path: &str) -> Value {
    let (status, page) = call_api(app_router, "GET", path, None).await;
    assert_eq!(status, 200, "{page}");
    page["items"][0].clone()
}

fn sorted_keys(answer: &Value) -> Vec<String> {
    let mut answer_keys: Vec<String> = answer
        .as_object()
        .map(|answer_fields| answer_fields.keys().cloned().collect())
        .unwrap_or_default();
    answer_keys.sort();
    answer_keys
}

// AC: PL-10.3
#[tokio::test]
async fn a_provider_request_with_the_project_header_is_stored_in_that_project() {
    let (app_router, _) = build_test_app();
    create_project(&app_router, "shop").await;

    let (status, answer) = call_provider(
        &app_router,
        &format!("/providers/twilio/{ACCOUNT_PATH}/Messages.json"),
        twilio_form(),
        Some("shop"),
    )
    .await;
    let (unknown_status, refusal) = call_provider(
        &app_router,
        &format!("/providers/twilio/{ACCOUNT_PATH}/Messages.json"),
        twilio_form(),
        Some("nowhere"),
    )
    .await;

    assert_eq!(status, 201, "{answer}");
    assert_eq!(
        newest_item(&app_router, "/api/v1/sms").await["project"],
        "shop"
    );
    assert_eq!(unknown_status, 404);
    assert_eq!(refusal["error"]["code"], "project_not_found");
}

// AC: PL-10.4
#[tokio::test]
async fn a_provider_path_under_a_project_prefix_answers_as_without_it() {
    let (app_router, _) = build_test_app();
    create_project(&app_router, "shop").await;

    let (plain_status, plain_answer) = call_provider(
        &app_router,
        &format!("/providers/twilio/{ACCOUNT_PATH}/Messages.json"),
        twilio_form(),
        None,
    )
    .await;
    let plain_project = newest_item(&app_router, "/api/v1/sms").await["project"].clone();
    let (prefixed_status, prefixed_answer) = call_provider(
        &app_router,
        &format!("/providers/twilio/projects/shop/{ACCOUNT_PATH}/Messages.json"),
        twilio_form(),
        None,
    )
    .await;

    assert_eq!((plain_status, prefixed_status), (201, 201));
    assert_eq!(sorted_keys(&plain_answer), sorted_keys(&prefixed_answer));
    assert_eq!(prefixed_answer["status"], plain_answer["status"]);
    assert_eq!(plain_project, "default");
    assert_eq!(
        newest_item(&app_router, "/api/v1/sms").await["project"],
        "shop"
    );
}

// AC: PL-10.4
#[tokio::test]
async fn the_provider_port_takes_the_prefix_for_email_and_verify_apis_too() {
    let (app_router, operation_context) = build_test_app();
    let provider_port_router = sendmock_api::build_provider_port_router(&operation_context, None);
    create_project(&app_router, "shop").await;
    let resend_email = json!({
        "from": "shop@example.test", "to": ["sam@example.test"], "subject": "In the shop",
        "text": "Hi",
    });

    let (email_status, _) = call_provider(
        &provider_port_router,
        "/projects/shop/emails",
        ("application/json", resend_email.to_string()),
        None,
    )
    .await;
    let (verify_status, verification) = call_provider(
        &provider_port_router,
        "/projects/shop/v2/verify",
        (
            "application/json",
            json!({ "brand": "Shop", "workflow": [{ "channel": "sms", "to": "447700900001" }] })
                .to_string(),
        ),
        None,
    )
    .await;
    let (unknown_status, _) = call_provider(
        &provider_port_router,
        "/projects/nowhere/emails",
        ("application/json", resend_email.to_string()),
        None,
    )
    .await;

    assert_eq!(email_status, 200);
    assert_eq!(
        newest_item(&app_router, "/api/v1/emails").await["project"],
        "shop"
    );
    assert_eq!(verify_status, 202, "{verification}");
    let verification_path = format!(
        "/api/v1/verify/{}",
        verification["request_id"].as_str().unwrap_or_default()
    );
    let (_, stored_verification) = call_api(&app_router, "GET", &verification_path, None).await;
    assert_eq!(stored_verification["project"], "shop");
    assert_eq!(unknown_status, 404);
}

// AC: PL-10.4
#[tokio::test]
async fn providers_cannot_take_the_projects_path() {
    let (app_router, _) = build_test_app();
    let (_, providers) = call_api(&app_router, "GET", "/api/v1/sms/providers", None).await;
    let mut provider = providers
        .as_array()
        .and_then(|providers| {
            providers
                .iter()
                .find(|provider| provider["key"] == "vonage")
        })
        .cloned()
        .unwrap_or_default();
    provider["operations"][0]["path"] = json!("/projects/{id}/sms");

    let (status, refusal) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/sms/providers/vonage",
        Some(&provider),
    )
    .await;

    assert_eq!(status, 400, "{refusal}");
    assert!(
        refusal["error"]["message"]
            .as_str()
            .unwrap_or_default()
            .contains("/projects/"),
        "{refusal}"
    );
}
