#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod project_requests;
    pub mod test_app;
}

use sendmock_ops::{OperationContext, SmtpMessage, store_smtp_message};
use serde_json::{Value, json};
use support::project_requests::{create_project, post_in_project};
use support::test_app::{build_test_app, call_api};

fn email_body(subject: &str) -> Value {
    json!({
        "from": "no-reply@shop.test", "to": ["sam@example.test"], "subject": subject,
        "text": "Hello",
    })
}

fn sms_body() -> Value {
    json!({ "from": "+15550001111", "to": "+8801700000000", "body": "Your code is 4821" })
}

async fn read_first_item_project(app_router: &axum::Router, path: &str) -> Value {
    let (status, page) = call_api(app_router, "GET", path, None).await;
    assert_eq!(status, 200, "{page}");
    page["items"][0]["project"].clone()
}

async fn receive_smtp_message(operation_context: &OperationContext, auth_user: Option<&str>) {
    store_smtp_message(
        operation_context,
        SmtpMessage {
            raw_message: b"Subject: Over SMTP\r\n\r\nHello\r\n".to_vec(),
            mail_from: "no-reply@shop.test".to_owned(),
            recipients: vec!["sam@example.test".to_owned()],
            smtp_session_id: "01JCK0000000000000000000SM".to_owned(),
            auth_user: auth_user.map(str::to_owned),
        },
    )
    .await
    .unwrap_or_else(|error| panic!("the message is stored: {error}"));
}

// AC: PL-10.2
#[tokio::test]
async fn an_smtp_username_that_is_a_project_key_sends_mail_to_that_project() {
    let (app_router, operation_context) = build_test_app();
    create_project(&app_router, "shop").await;

    receive_smtp_message(&operation_context, Some("shop")).await;
    let shop_project = read_first_item_project(&app_router, "/api/v1/emails").await;
    receive_smtp_message(&operation_context, Some("laravel-app")).await;
    let other_username_project = read_first_item_project(&app_router, "/api/v1/emails").await;
    receive_smtp_message(&operation_context, None).await;
    let without_auth_project = read_first_item_project(&app_router, "/api/v1/emails").await;

    assert_eq!(shop_project, "shop");
    assert_eq!(other_username_project, "default");
    assert_eq!(without_auth_project, "default");
}

// AC: PL-10.3
#[tokio::test]
async fn the_project_header_stores_emails_sms_and_verifications_in_that_project() {
    let (app_router, _) = build_test_app();
    create_project(&app_router, "shop").await;

    let (email_status, _) =
        post_in_project(&app_router, "/api/v1/send", &email_body("Hi"), "shop").await;
    let (sms_status, _) = post_in_project(&app_router, "/api/v1/sms", &sms_body(), "shop").await;
    let (sample_status, sample) = post_in_project(
        &app_router,
        "/api/v1/samples/verification",
        &json!({}),
        "shop",
    )
    .await;
    let verification_path = format!(
        "/api/v1/verify/{}",
        sample["id"].as_str().unwrap_or_default()
    );
    let (_, verification) = call_api(&app_router, "GET", &verification_path, None).await;

    assert_eq!((email_status, sms_status, sample_status), (201, 201, 201));
    assert_eq!(
        read_first_item_project(&app_router, "/api/v1/emails").await,
        "shop"
    );
    assert_eq!(
        read_first_item_project(&app_router, "/api/v1/sms").await,
        "shop"
    );
    assert_eq!(verification["project"], "shop");
}

// AC: PL-10.3
#[tokio::test]
async fn an_unknown_project_is_refused_and_no_header_means_default() {
    let (app_router, _) = build_test_app();

    let (refused_status, refusal) =
        post_in_project(&app_router, "/api/v1/send", &email_body("Hi"), "shpo").await;
    let (sent_status, _) =
        call_api(&app_router, "POST", "/api/v1/send", Some(&email_body("Hi"))).await;
    let (_, emails) = call_api(&app_router, "GET", "/api/v1/emails", None).await;

    assert_eq!(refused_status, 404);
    assert_eq!(refusal["error"]["code"], "project_not_found");
    assert_eq!(sent_status, 201);
    assert_eq!(emails["items"].as_array().map(Vec::len), Some(1));
    assert_eq!(emails["items"][0]["project"], "default");
}

// AC: PL-10.1
#[tokio::test]
async fn deleting_a_project_deletes_its_traffic_and_keeps_the_rest() {
    let (app_router, _) = build_test_app();
    create_project(&app_router, "shop").await;
    post_in_project(
        &app_router,
        "/api/v1/send",
        &email_body("Shop mail"),
        "shop",
    )
    .await;
    post_in_project(&app_router, "/api/v1/sms", &sms_body(), "shop").await;
    call_api(
        &app_router,
        "POST",
        "/api/v1/send",
        Some(&email_body("Kept")),
    )
    .await;
    let (_, projects_before) = call_api(&app_router, "GET", "/api/v1/projects", None).await;

    let (delete_status, _) = call_api(&app_router, "DELETE", "/api/v1/projects/shop", None).await;
    let (_, emails) = call_api(&app_router, "GET", "/api/v1/emails", None).await;
    let (_, sms_page) = call_api(&app_router, "GET", "/api/v1/sms", None).await;

    assert_eq!(projects_before[1]["email_count"], 1);
    assert_eq!(projects_before[1]["sms_count"], 1);
    assert_eq!(delete_status, 204);
    assert_eq!(emails["items"].as_array().map(Vec::len), Some(1));
    assert_eq!(emails["items"][0]["subject"], "Kept");
    assert_eq!(sms_page["items"].as_array().map(Vec::len), Some(0));
}
