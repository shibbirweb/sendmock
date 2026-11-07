#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod payment_notification_fixture;
    pub mod scripted_webhook_sender;
    pub mod sslcommerz_requests;
    pub mod test_app;
    pub mod webhook_samples;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::Value;
use support::sslcommerz_requests::send_request;
use support::test_app::build_test_app;
use support::webhook_samples::endpoint_input;

async fn create_endpoint_as(app_router: &axum::Router, client_name: Option<&str>) -> Value {
    let mut request_builder = Request::builder()
        .method("POST")
        .uri("/api/v1/webhooks/endpoints")
        .header("content-type", "application/json");
    if let Some(client_name) = client_name {
        request_builder = request_builder.header("x-sendmock-client", client_name);
    }
    let request = request_builder
        .body(Body::from(
            endpoint_input(&format!("Made by {client_name:?}")).to_string(),
        ))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let (status, created_endpoint) = send_request(app_router.clone(), request).await;
    assert_eq!(status, 201, "{created_endpoint}");
    created_endpoint
}

// AC: AI-05.4
#[tokio::test]
async fn new_items_record_the_client_that_made_them() {
    let (app_router, _) = build_test_app();

    let by_mcp = create_endpoint_as(&app_router, Some("mcp")).await;
    let by_cli = create_endpoint_as(&app_router, Some("cli")).await;
    let by_ui = create_endpoint_as(&app_router, Some("ui")).await;
    let by_plain_call = create_endpoint_as(&app_router, None).await;
    let by_unknown = create_endpoint_as(&app_router, Some("robot")).await;

    assert_eq!(by_mcp["created_by"], "mcp");
    assert_eq!(by_cli["created_by"], "cli");
    assert_eq!(by_ui["created_by"], "ui");
    assert_eq!(by_plain_call["created_by"], "api");
    assert_eq!(by_unknown["created_by"], "api");
}
