//! `POST /api/v1/send` stores the same email as the equivalent message an app sends over SMTP,
//! which `POST /api/v1/send/raw` takes through the same ingest as the SMTP listener.

#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

/// "Order #1042 attached" as a two-byte text file, base64 `MTA=` is "10".
const RAW_MESSAGE: &str = "From: Shop <no-reply@shop.test>\r\n\
To: sam@example.test\r\n\
Cc: manager@example.test\r\n\
Subject: Your order #1042\r\n\
X-Order-Id: 1042\r\n\
MIME-Version: 1.0\r\n\
Content-Type: multipart/mixed; boundary=\"outer\"\r\n\
\r\n\
--outer\r\n\
Content-Type: multipart/alternative; boundary=\"inner\"\r\n\
\r\n\
--inner\r\n\
Content-Type: text/plain; charset=utf-8\r\n\
\r\n\
Hi Sam, your order is on its way.\r\n\
--inner\r\n\
Content-Type: text/html; charset=utf-8\r\n\
\r\n\
<p>Hi Sam, your order is <b>on its way</b>.</p>\r\n\
--inner--\r\n\
--outer\r\n\
Content-Type: text/plain\r\n\
Content-Disposition: attachment; filename=\"order.txt\"\r\n\
Content-Transfer-Encoding: base64\r\n\
\r\n\
MTA=\r\n\
--outer--\r\n";

fn native_order() -> Value {
    json!({
        "from": "Shop <no-reply@shop.test>",
        "to": ["sam@example.test"],
        "cc": ["manager@example.test"],
        "bcc": ["audit@shop.test"],
        "subject": "Your order #1042",
        "text": "Hi Sam, your order is on its way.",
        "html": "<p>Hi Sam, your order is <b>on its way</b>.</p>",
        "headers": { "X-Order-Id": "1042" },
        "attachments": [
            { "filename": "order.txt", "content": "MTA=", "content_type": "text/plain" }
        ],
    })
}

async fn send_raw(app_router: &axum::Router) -> Value {
    let request = Request::builder()
        .method("POST")
        .uri("/api/v1/send/raw")
        .header("content-type", "message/rfc822")
        .body(Body::from(RAW_MESSAGE))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    serde_json::from_slice(&body_bytes).unwrap_or_else(|error| panic!("a JSON body: {error}"))
}

async fn read_email(app_router: &axum::Router, created: &Value) -> Value {
    let email_id = created["id"].as_str().unwrap_or_default();
    let (status, email) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}"),
        None,
    )
    .await;
    assert_eq!(status, 200, "{email}");
    email
}

/// What both ways must agree on: the people, the subject, both bodies, the custom header and
/// the attachment.
fn compared_parts(email: &Value) -> Value {
    let custom_header = email["headers"]
        .as_object()
        .and_then(|headers| {
            headers
                .iter()
                .find(|(header_name, _)| header_name.eq_ignore_ascii_case("x-order-id"))
        })
        .map(|(_, header_values)| header_values.clone())
        .unwrap_or(Value::Null);
    let attachments: Vec<Value> = email["attachments"]
        .as_array()
        .map(|attachments| {
            attachments
                .iter()
                .map(|attachment| {
                    json!([
                        attachment["filename"],
                        attachment["content_type"],
                        attachment["size_bytes"]
                    ])
                })
                .collect()
        })
        .unwrap_or_default();
    json!({
        "from": email["from"],
        "to": email["to"],
        "cc": email["cc"],
        "subject": email["subject"],
        "text_body": email["text_body"].as_str().map(str::trim),
        "html_body": email["html_body"].as_str().map(str::trim),
        "custom_header": custom_header,
        "attachments": attachments,
    })
}

// AC: EM-07.1
#[tokio::test]
async fn a_native_send_stores_the_same_email_as_the_equivalent_smtp_message() {
    let (app_router, _) = build_test_app();
    let (native_status, native_created) =
        call_api(&app_router, "POST", "/api/v1/send", Some(&native_order())).await;
    let raw_created = send_raw(&app_router).await;

    let native_email = read_email(&app_router, &native_created).await;
    let raw_email = read_email(&app_router, &raw_created).await;

    assert_eq!(native_status, 201, "{native_created}");
    assert_eq!(compared_parts(&native_email), compared_parts(&raw_email));
    assert_eq!(native_email["attachments"][0]["size_bytes"], 2);
    assert_eq!(native_email["bcc"][0]["address"], "audit@shop.test");
}

async fn download(app_router: &axum::Router, path: &str) -> (u16, String, Vec<u8>) {
    let request = Request::builder()
        .uri(path)
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let disposition = response
        .headers()
        .get("content-disposition")
        .and_then(|header_value| header_value.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    (status, disposition, body_bytes.to_vec())
}

// AC: EM-04.6
#[tokio::test]
async fn each_mime_part_downloads_decoded_with_its_name() {
    let (app_router, _) = build_test_app();
    let raw_created = send_raw(&app_router).await;
    let email_id = raw_created["id"].as_str().unwrap_or_default();

    let (_, mime_tree) = call_api(
        &app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}/mime"),
        None,
    )
    .await;
    let (attachment_status, attachment_disposition, attachment_bytes) =
        download(&app_router, &format!("/api/v1/emails/{email_id}/mime/1.2")).await;
    let (text_status, _, text_bytes) = download(
        &app_router,
        &format!("/api/v1/emails/{email_id}/mime/1.1.1"),
    )
    .await;
    let (missing_status, _, _) =
        download(&app_router, &format!("/api/v1/emails/{email_id}/mime/1.9")).await;

    assert_eq!(mime_tree["children"][1]["part_id"], "1.2");
    assert_eq!(attachment_status, 200);
    assert!(
        attachment_disposition.contains("order.txt"),
        "{attachment_disposition}"
    );
    assert_eq!(attachment_bytes, b"10");
    assert_eq!(text_status, 200);
    assert_eq!(
        String::from_utf8_lossy(&text_bytes).trim(),
        "Hi Sam, your order is on its way."
    );
    assert_eq!(missing_status, 404);
}
