#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const PROVIDER_PREFIX: &str = "/providers/whatsapp_cloud";
const BOUNDARY: &str = "sendmock-media-boundary";
const INVOICE_BYTES: &[u8] = b"%PDF-1.4 invoice 1042";

/// The multipart upload Meta's media endpoint takes: `messaging_product`, `type` and `file`.
fn build_upload_body() -> Vec<u8> {
    let mut body = Vec::new();
    for (field_name, field_value) in [
        ("messaging_product", "whatsapp"),
        ("type", "application/pdf"),
    ] {
        body.extend_from_slice(
            format!("--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"{field_name}\"\r\n\r\n{field_value}\r\n").as_bytes(),
        );
    }
    body.extend_from_slice(
        format!("--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"invoice.pdf\"\r\nContent-Type: application/pdf\r\n\r\n").as_bytes(),
    );
    body.extend_from_slice(INVOICE_BYTES);
    body.extend_from_slice(format!("\r\n--{BOUNDARY}--\r\n").as_bytes());
    body
}

/// Sends a raw request; answers the status, the content type and the body bytes.
async fn send_raw(
    app_router: &axum::Router,
    method: &str,
    uri: &str,
    content_type: Option<&str>,
    body: Vec<u8>,
) -> (u16, String, Vec<u8>) {
    let mut request_builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("host", "127.0.0.1:8025");
    if let Some(content_type) = content_type {
        request_builder = request_builder.header("content-type", content_type);
    }
    let request = request_builder
        .body(Body::from(body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|header_value| header_value.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    (status, content_type, body_bytes.to_vec())
}

async fn upload_invoice(app_router: &axum::Router) -> String {
    let (status, _, answer_bytes) = send_raw(
        app_router,
        "POST",
        &format!("{PROVIDER_PREFIX}/v21.0/106540352242922/media"),
        Some(&format!("multipart/form-data; boundary={BOUNDARY}")),
        build_upload_body(),
    )
    .await;
    let answer: Value = serde_json::from_slice(&answer_bytes).unwrap_or(Value::Null);
    assert_eq!(status, 200, "{answer}");
    answer["id"].as_str().unwrap_or_default().to_owned()
}

// AC: SM-18.3
#[tokio::test]
async fn uploaded_media_is_looked_up_downloaded_and_deleted() {
    let (app_router, _) = build_test_app();
    let media_id = upload_invoice(&app_router).await;
    let media_path = format!("{PROVIDER_PREFIX}/v21.0/{media_id}");

    let (lookup_status, _, lookup_bytes) =
        send_raw(&app_router, "GET", &media_path, None, Vec::new()).await;
    let lookup: Value = serde_json::from_slice(&lookup_bytes).unwrap_or(Value::Null);
    let download_url = lookup["url"].as_str().unwrap_or_default();
    let download_path = download_url.trim_start_matches("http://127.0.0.1:8025");
    let (download_status, download_type, downloaded) =
        send_raw(&app_router, "GET", download_path, None, Vec::new()).await;
    let (delete_status, delete_answer) = call_api(&app_router, "DELETE", &media_path, None).await;
    let (gone_status, gone) = call_api(&app_router, "GET", &media_path, None).await;

    assert!(
        media_id.chars().all(|character| character.is_ascii_digit()),
        "{media_id}"
    );
    assert_eq!(lookup_status, 200, "{lookup}");
    assert_eq!(lookup["mime_type"], "application/pdf");
    assert_eq!(lookup["file_size"], INVOICE_BYTES.len());
    assert_eq!(lookup["sha256"].as_str().map(str::len), Some(64));
    assert!(
        download_url.starts_with(
            "http://127.0.0.1:8025/providers/whatsapp_cloud/whatsapp_business/attachments/?mid="
        ),
        "{download_url}"
    );
    assert_eq!(
        (download_status, download_type.as_str()),
        (200, "application/pdf")
    );
    assert_eq!(downloaded, INVOICE_BYTES);
    assert_eq!(
        (delete_status, delete_answer),
        (200, json!({ "success": true }))
    );
    assert_eq!(gone_status, 400);
    assert_eq!(gone["error"]["code"], 100);
}

// AC: SM-18.3
#[tokio::test]
async fn a_document_sent_by_media_id_carries_the_uploaded_file() {
    let (app_router, _) = build_test_app();
    let media_id = upload_invoice(&app_router).await;
    let document_message = json!({
        "messaging_product": "whatsapp", "to": "16505551234", "type": "document",
        "document": { "id": media_id, "filename": "invoice.pdf" },
    });

    let (status, answer) = call_api(
        &app_router,
        "POST",
        &format!("{PROVIDER_PREFIX}/v21.0/106540352242922/messages"),
        Some(&document_message),
    )
    .await;
    let (_, page) = call_api(&app_router, "GET", "/api/v1/sms?api=whatsapp_cloud", None).await;

    assert_eq!(status, 200, "{answer}");
    let stored = &page["items"][0];
    assert_eq!(stored["body"], "Document invoice.pdf");
    assert_eq!(stored["media"][0]["content_type"], "application/pdf");
    assert_eq!(stored["media"][0]["filename"], "invoice.pdf");
    assert_eq!(stored["media"][0]["size_bytes"], INVOICE_BYTES.len());
}
