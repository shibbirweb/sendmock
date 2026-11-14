#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::email_provider_requests::send_json;
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

async fn read_newest_sms(app_router: &axum::Router) -> Value {
    let (_, sms_list) = call_api(app_router, "GET", "/api/v1/sms", None).await;
    sms_list["items"][0].clone()
}

// AC: SM-05.1
#[tokio::test]
async fn plivo_queues_a_message_and_names_a_missing_parameter_in_its_shape() {
    let (app_router, _) = build_test_app();
    let plivo_path = "/providers/plivo/v1/Account/MAXXXXXXXXXXXXXXXXXX/Message/";

    let sent = send_json(
        &app_router,
        plivo_path,
        &json!({ "src": "+15550006666", "dst": "+8801700000000", "text": "Your code is 482913" }),
    )
    .await;
    let refused = send_json(
        &app_router,
        plivo_path,
        &json!({ "src": "+15550006666", "text": "Hi" }),
    )
    .await;

    assert_eq!(sent.status, 202, "{}", sent.body_text);
    assert_eq!(sent.body["message"], "message(s) queued");
    assert!(
        sent.body["message_uuid"][0].is_string(),
        "{}",
        sent.body_text
    );
    let stored_sms = read_newest_sms(&app_router).await;
    assert_eq!(stored_sms["to_number"], "+8801700000000");
    assert_eq!(stored_sms["api"], "plivo");
    assert_eq!(refused.status, 400, "{}", refused.body_text);
    assert!(
        refused.body["error"]
            .as_str()
            .is_some_and(|message| message.contains("missing"))
    );
}

// AC: SM-05.1
#[tokio::test]
async fn messagebird_answers_its_message_object_and_its_errors_list() {
    let (app_router, _) = build_test_app();

    let sent = send_json(
        &app_router,
        "/providers/messagebird/messages",
        &json!({ "originator": "Shop", "recipients": ["+31612345678"], "body": "Hello" }),
    )
    .await;
    let refused = send_json(
        &app_router,
        "/providers/messagebird/messages",
        &json!({ "originator": "Shop", "recipients": ["+31612345678"] }),
    )
    .await;

    assert_eq!(sent.status, 201, "{}", sent.body_text);
    assert_eq!(sent.body["direction"], "mt");
    assert_eq!(
        sent.body["recipients"]["items"][0]["recipient"],
        "+31612345678"
    );
    assert_eq!(read_newest_sms(&app_router).await["api"], "messagebird");
    assert_eq!(refused.status, 422, "{}", refused.body_text);
    assert_eq!(refused.body["errors"][0]["code"], 9);
}

/// A regional vendor's client: `GET /smsapi?api_key=...&number=...&message=...&senderid=...`.
async fn create_generic_vendor(app_router: &axum::Router) {
    let (status, created) = call_api(
        app_router,
        "POST",
        "/api/v1/sms/providers",
        Some(&json!({ "name": "BulkSMS BD", "key": "bulksms_bd", "start_from": null })),
    )
    .await;
    assert_eq!(status, 201, "{created}");
    let mut changed = created.clone();
    if let Some(fields) = changed.as_object_mut() {
        for read_only_field in [
            "area",
            "is_builtin",
            "is_modified",
            "is_removed",
            "message_count_24h",
        ] {
            fields.remove(read_only_field);
        }
    }
    changed["operations"] =
        json!([{ "kind": "send", "method": "GET", "path": "/smsapi", "request_format": "query" }]);
    changed["field_mapping"] = json!([
        { "part": "to", "source": "number" },
        { "part": "body", "source": "message" },
        { "part": "from", "source": "senderid" },
    ]);
    let (update_status, updated) = call_api(
        app_router,
        "PATCH",
        "/api/v1/sms/providers/bulksms_bd",
        Some(&changed),
    )
    .await;
    assert_eq!(update_status, 200, "{updated}");
}

// AC: SM-05.2
#[tokio::test]
async fn a_generic_get_vendor_with_its_own_parameter_names_captures_sms() {
    let (app_router, _) = build_test_app();
    create_generic_vendor(&app_router).await;

    let response = app_router
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/providers/bulksms_bd/smsapi?api_key=abc123&number=8801700000000&message=Your+code+is+482913&senderid=Shop")
                .body(Body::empty())
                .unwrap_or_else(|error| panic!("a valid request: {error}")),
        )
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));

    assert_eq!(response.status().as_u16(), 200);
    let stored_sms = read_newest_sms(&app_router).await;
    assert_eq!(stored_sms["api"], "bulksms_bd", "{stored_sms}");
    assert_eq!(stored_sms["body"], "Your code is 482913");
    assert_eq!(stored_sms["from_number"], "Shop");
}
