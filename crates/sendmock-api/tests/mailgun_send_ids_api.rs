#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::email_provider_requests::{read_newest_email, send_provider_request};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const MESSAGES_PATH: &str = "/providers/mailgun/v3/mg.shop.test/messages";
const BOUNDARY: &str = "mailgun-boundary";

fn build_form(fields: &[(&str, &str)]) -> Vec<u8> {
    let mut form_body = String::new();
    for (field_name, field_value) in fields {
        form_body.push_str(&format!(
            "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"{field_name}\"\r\n\r\n{field_value}\r\n"
        ));
    }
    form_body.push_str(&format!("--{BOUNDARY}--\r\n"));
    form_body.into_bytes()
}

async fn send_form(app_router: &axum::Router, path: &str, fields: &[(&str, &str)]) -> Value {
    let reply = send_provider_request(
        app_router,
        path,
        &format!("multipart/form-data; boundary={BOUNDARY}"),
        build_form(fields),
    )
    .await;
    assert_eq!(reply.status, 200, "{}", reply.body_text);
    reply.body
}

const ADDRESS_FIELDS: [(&str, &str); 3] = [
    ("from", "Shop <shop@mg.shop.test>"),
    ("to", "sam@example.test"),
    ("subject", "Welcome"),
];

// AC: EM-24.1
#[tokio::test]
async fn a_template_send_without_a_body_is_accepted_and_keeps_its_template_id() {
    let (app_router, _) = build_test_app();
    let mut fields = ADDRESS_FIELDS.to_vec();
    fields.extend([
        ("template", "welcome-email"),
        ("t:variables", r#"{"first_name": "Sam"}"#),
    ]);

    send_form(&app_router, MESSAGES_PATH, &fields).await;
    let email = read_newest_email(&app_router).await;

    assert_eq!(email["template"]["template_id"], "welcome-email", "{email}");
    assert_eq!(
        email["template"]["template_data"],
        json!({ "first_name": "Sam" })
    );
}

// AC: EM-24.2
#[tokio::test]
async fn v_fields_and_the_variables_header_are_kept_as_user_variables() {
    let (app_router, _) = build_test_app();
    let mut fields = ADDRESS_FIELDS.to_vec();
    fields.extend([
        ("text", "Hello"),
        ("h:X-Mailgun-Variables", r#"{"customer_id": 42}"#),
        ("v:order-id", "A-1001"),
    ]);

    send_form(&app_router, MESSAGES_PATH, &fields).await;
    let email = read_newest_email(&app_router).await;

    assert_eq!(
        email["user_variables"],
        json!({ "customer_id": 42, "order-id": "A-1001" }),
        "{email}"
    );
}

// AC: EM-24.2
#[tokio::test]
async fn a_mime_send_keeps_the_variables_header_as_user_variables() {
    let (app_router, _) = build_test_app();
    let raw_message = "From: Shop <shop@mg.shop.test>\r\nTo: sam@example.test\r\nSubject: MIME\r\nX-Mailgun-Variables: {\"customer_id\": 7}\r\nContent-Type: text/plain\r\n\r\nShipped";
    let form_body = format!(
        "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"to\"\r\n\r\nsam@example.test\r\n\
         --{BOUNDARY}\r\nContent-Disposition: form-data; name=\"message\"; filename=\"message.mime\"\r\nContent-Type: message/rfc822\r\n\r\n{raw_message}\r\n--{BOUNDARY}--\r\n"
    );

    let reply = send_provider_request(
        &app_router,
        "/providers/mailgun/v3/mg.shop.test/messages.mime",
        &format!("multipart/form-data; boundary={BOUNDARY}"),
        form_body.into_bytes(),
    )
    .await;
    let email = read_newest_email(&app_router).await;

    assert_eq!(reply.status, 200, "{}", reply.body_text);
    assert_eq!(
        email["user_variables"],
        json!({ "customer_id": 7 }),
        "{email}"
    );
}

// AC: EM-24.3
#[tokio::test]
async fn the_email_and_its_mailgun_webhook_carry_the_id_the_send_answered() {
    let (app_router, _) = build_test_app();
    let mut fields = ADDRESS_FIELDS.to_vec();
    fields.push(("text", "Hello"));

    let send_answer = send_form(&app_router, MESSAGES_PATH, &fields).await;
    let email = read_newest_email(&app_router).await;
    let (preview_status, preview) = call_api(
        &app_router,
        "POST",
        "/api/v1/webhooks/endpoints/preview",
        Some(&json!({
            "endpoint": { "url": "http://localhost:3000/mailgun", "template_id": "mailgun.events" },
            "email_id": email["id"],
            "variables": { "mailgun_signing_key": "key-test" },
        })),
    )
    .await;

    let answered_id = send_answer["id"].as_str().unwrap_or_default();
    assert_eq!(email["provider_message_id"], answered_id);
    assert_eq!(preview_status, 200, "{preview}");
    let webhook_body: Value = serde_json::from_str(preview["body"].as_str().unwrap_or_default())
        .unwrap_or_else(|error| panic!("{error}: {preview}"));
    assert_eq!(
        webhook_body["event-data"]["message"]["headers"]["message-id"],
        answered_id.trim_start_matches('<').trim_end_matches('>')
    );
}

async fn call_mailgun(app_router: &axum::Router, method: &str, path: &str, form_body: &str) -> u16 {
    let request = Request::builder()
        .method(method)
        .uri(path)
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

// AC: EM-24.4
#[tokio::test]
async fn a_complaint_is_deleted_by_its_percent_encoded_address() {
    let (app_router, _) = build_test_app();
    let complaints_path = "/providers/mailgun/v3/mg.shop.test/complaints";
    call_mailgun(
        &app_router,
        "POST",
        complaints_path,
        "address=user%40example.org",
    )
    .await;

    let delete_status = call_mailgun(
        &app_router,
        "DELETE",
        &format!("{complaints_path}/user%40example.org"),
        "",
    )
    .await;
    let fetch_status = call_mailgun(
        &app_router,
        "GET",
        &format!("{complaints_path}/user@example.org"),
        "",
    )
    .await;

    assert_eq!(delete_status, 200);
    assert_eq!(fetch_status, 404);
}
