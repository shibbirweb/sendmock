#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const ONE_PIXEL_PNG_BASE64: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

fn native_sms(body: &str) -> Value {
    json!({ "from": "+15550001111", "to": "+8801700000000", "body": body })
}

async fn send_raw(
    app_router: &axum::Router,
    request: Request<Body>,
) -> (u16, Value, Vec<u8>, String) {
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"))
        .to_vec();
    (
        status,
        serde_json::from_slice(&body_bytes).unwrap_or(Value::Null),
        body_bytes,
        content_type,
    )
}

// AC: SM-01.1
#[tokio::test]
async fn a_json_or_form_send_is_stored_with_its_status_segments_and_encoding() {
    let (app_router, _) = build_test_app();

    let (json_status, json_sms) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&native_sms("Your code is 482913")),
    )
    .await;
    let form_request = Request::post("/api/v1/sms")
        .header("content-type", "application/x-www-form-urlencoded")
        .body(Body::from(
            "from=%2B15550001111&to=%2B8801700000000&body=Hola+se%C3%B1or",
        ))
        .unwrap_or_else(|error| panic!("{error}"));
    let (form_status, form_sms, _, _) = send_raw(&app_router, form_request).await;

    assert_eq!(json_status, 201);
    assert_eq!(json_sms["status"], "queued");
    assert_eq!(json_sms["segments"], 1);
    assert_eq!(json_sms["encoding"], "GSM-7");
    assert_eq!(json_sms["extracted"]["otp"], json!(["482913"]));
    assert_eq!(form_status, 201);
    assert_eq!(form_sms["body"], "Hola señor");
    assert_eq!(form_sms["encoding"], "GSM-7");
}

// AC: SM-01.2
#[tokio::test]
async fn the_get_variant_sends_from_the_query_string() {
    let (app_router, _) = build_test_app();

    let (status, sms) = call_api(
        &app_router,
        "GET",
        "/api/v1/sms/send?from=ACME&to=%2B8801700000000&body=Hi",
        None,
    )
    .await;

    assert_eq!(status, 201);
    assert_eq!(sms["from_number"], "ACME");
    assert_eq!(sms["to_number"], "+8801700000000");
}

// AC: SM-01.3
#[tokio::test]
async fn a_missing_recipient_or_text_is_refused_with_its_field() {
    let (app_router, _) = build_test_app();

    let (missing_to_status, missing_to) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&json!({ "from": "+15550001111", "body": "Hi" })),
    )
    .await;
    let (empty_body_status, empty_body) =
        call_api(&app_router, "POST", "/api/v1/sms", Some(&native_sms("  "))).await;

    assert_eq!(missing_to_status, 400);
    assert_eq!(missing_to["error"]["field"], "to");
    assert_eq!(empty_body_status, 400);
    assert_eq!(empty_body["error"]["field"], "body");
}

// AC: SM-15.2
#[tokio::test]
async fn inline_media_is_stored_and_served_with_its_content_type() {
    let (app_router, _) = build_test_app();
    let mms = json!({
        "from": "+15550001111", "to": "+8801700000000", "body": "Your receipt",
        "media": [{ "filename": "receipt.png", "content": ONE_PIXEL_PNG_BASE64 }],
    });

    let (status, sms) = call_api(&app_router, "POST", "/api/v1/sms", Some(&mms)).await;
    let media_url = sms["media"][0]["url"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let media_request = Request::get(media_url)
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("{error}"));
    let (media_status, _, media_bytes, content_type) = send_raw(&app_router, media_request).await;

    assert_eq!(status, 201);
    assert_eq!(sms["media"][0]["content_type"], "image/png");
    assert_eq!(media_status, 200);
    assert_eq!(content_type, "image/png");
    assert!(media_bytes.starts_with(&[0x89, b'P', b'N', b'G']));
}

// AC: SM-15.3
#[tokio::test]
async fn bad_media_is_refused_naming_the_item() {
    let (app_router, _) = build_test_app();
    let with_media = |media: Value| json!({ "from": "+15550001111", "to": "+8801700000000", "body": "x", "media": media });
    let eleven_files: Vec<Value> = (0..11)
        .map(|_| json!({ "filename": "a.png", "content": ONE_PIXEL_PNG_BASE64 }))
        .collect();

    let (_, no_filename) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&with_media(json!([{ "content": ONE_PIXEL_PNG_BASE64 }]))),
    )
    .await;
    let (_, bad_base64) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&with_media(
            json!([{ "filename": "a.png", "content": "%%%" }]),
        )),
    )
    .await;
    let (too_many_status, _) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&with_media(Value::Array(eleven_files))),
    )
    .await;

    assert_eq!(
        no_filename["error"]["message"],
        "media[0].filename is required"
    );
    assert_eq!(
        bad_base64["error"]["message"],
        "media[0].content is not valid base64"
    );
    assert_eq!(too_many_status, 400);
}

// AC: SM-15.1
#[tokio::test]
async fn a_media_link_that_cannot_be_fetched_fails_the_message_with_11200() {
    let (app_router, _) = build_test_app();
    let with_link = json!({ "from": "+15550001111", "to": "+8801700000000", "body": "x", "media_urls": ["http://127.0.0.1:9/gone.png"] });

    let (status, sms) = call_api(&app_router, "POST", "/api/v1/sms", Some(&with_link)).await;

    assert_eq!(status, 201);
    assert_eq!(sms["status"], "failed");
    assert_eq!(sms["error_code"], "11200");
}

#[tokio::test]
async fn an_inbound_message_joins_the_conversation_and_the_code_is_found_by_channel() {
    let (app_router, _) = build_test_app();
    call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&native_sms("Your code is 482913")),
    )
    .await;

    let (inbound_status, inbound) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms/inbound",
        Some(&json!({ "from": "+8801700000000", "to": "+15550001111", "body": "STOP" })),
    )
    .await;
    let (_, threads) = call_api(&app_router, "GET", "/api/v1/sms/threads", None).await;
    let (otp_status, otp) = call_api(
        &app_router,
        "GET",
        "/api/v1/otp?to=%2B8801700000000&channel=sms",
        None,
    )
    .await;
    let (wait_status, waited) = call_api(
        &app_router,
        "GET",
        "/api/v1/wait/sms?to=%2B15550001111&timeout=1s",
        None,
    )
    .await;

    assert_eq!(inbound_status, 201);
    assert_eq!(inbound["status"], "received");
    assert_eq!(threads.as_array().map(Vec::len), Some(1));
    assert_eq!(threads[0]["message_count"], 2);
    assert_eq!(threads[0]["unread_count"], 1);
    assert_eq!((otp_status, otp["code"].clone()), (200, json!("482913")));
    assert_eq!((wait_status, waited["body"].clone()), (200, json!("STOP")));
}

#[tokio::test]
async fn a_manual_status_change_is_recorded_in_the_history() {
    let (app_router, _) = build_test_app();
    let (_, sms) = call_api(&app_router, "POST", "/api/v1/sms", Some(&native_sms("Hi"))).await;
    let status_path = format!(
        "/api/v1/sms/{}/status",
        sms["id"].as_str().unwrap_or_default()
    );

    let (status, updated) = call_api(
        &app_router,
        "POST",
        &status_path,
        Some(&json!({ "status": "undelivered", "error_code": "30003" })),
    )
    .await;
    let (bad_status, _) = call_api(
        &app_router,
        "POST",
        &status_path,
        Some(&json!({ "status": "lost" })),
    )
    .await;

    assert_eq!(status, 200);
    assert_eq!(updated["error_code"], "30003");
    assert_eq!(updated["status_history"].as_array().map(Vec::len), Some(2));
    assert_eq!(bad_status, 400);
}
