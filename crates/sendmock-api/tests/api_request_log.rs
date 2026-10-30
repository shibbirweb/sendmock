use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use sendmock_api::{EmbeddedUiAssets, build_app_router};
use sendmock_core::{FixedClock, SystemIdGenerator};
use sendmock_ops::{InstanceDetails, OperationContext, ReleaseChannel, build_operation_registry};
use sendmock_store::{Database, DatabaseLocation, EMBEDDED_MIGRATIONS};
use serde_json::Value;
use tower::ServiceExt;

fn build_router() -> axum::Router {
    let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
        .unwrap_or_else(|error| panic!("an in-memory database: {error}"));
    let operation_context = OperationContext::new(
        Arc::new(database),
        Arc::new(FixedClock::new(1_767_225_600_000)),
        Arc::new(SystemIdGenerator),
        InstanceDetails {
            version: "0.0.0",
            channel: ReleaseChannel::Dev,
            started_at_unix_ms: 1_767_225_600_000,
            http_address: "127.0.0.1:8025".to_owned(),
            smtp_address: "127.0.0.1:1025".to_owned(),
            provider_address: None,
            is_container: false,
        },
    );
    build_app_router(
        &build_operation_registry(),
        &operation_context,
        Arc::new(EmbeddedUiAssets),
    )
}

/// Answers the status and the body text.
async fn send_request(app_router: &axum::Router, request: Request<Body>) -> (u16, String) {
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    (status, String::from_utf8_lossy(&body_bytes).into_owned())
}

fn post_send(body: &str) -> Request<Body> {
    Request::post("/api/v1/send")
        .header("content-type", "application/json")
        .header("authorization", "Bearer secret-token")
        .body(Body::from(body.to_owned()))
        .unwrap_or_else(|error| panic!("a valid request: {error}"))
}

async fn list_logged_requests(app_router: &axum::Router, query: &str) -> Value {
    let request = Request::get(format!("/api/v1/logs/http{query}"))
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let (_, body_text) = send_request(app_router, request).await;
    serde_json::from_str(&body_text).unwrap_or_else(|error| panic!("a JSON page: {error}"))
}

#[tokio::test]
async fn a_rejected_native_request_is_logged_with_the_exact_response() {
    let app_router = build_router();

    let (status, response_body) =
        send_request(&app_router, post_send(r#"{"subject":"No sender"}"#)).await;
    let logged_page = list_logged_requests(&app_router, "?status_class=4xx").await;

    let logged_request = &logged_page["items"][0];
    assert_eq!(status, 400);
    assert_eq!(logged_page["total_count"], 1);
    assert_eq!(logged_request["api"], "native");
    assert_eq!(logged_request["response_status"], 400);
    assert_eq!(logged_request["response_body"], response_body.as_str());
    assert_eq!(logged_request["linked_message"], Value::Null);
}

// AC: SM-13.2
// AC: SM-13.3
#[tokio::test]
async fn an_accepted_request_links_to_its_email_and_hides_the_credentials() {
    let app_router = build_router();
    let send_body =
        r#"{"from":"app@shop.test","to":["sam@example.test"],"subject":"Hi","text":"Hello"}"#;

    let (status, response_body) = send_request(&app_router, post_send(send_body)).await;
    let logged_page = list_logged_requests(&app_router, "?api=native&path=send").await;

    let created_email: Value = serde_json::from_str(&response_body).unwrap_or_default();
    let logged_request = &logged_page["items"][0];
    assert_eq!(status, 201);
    assert_eq!(logged_request["request_body"], send_body);
    assert_eq!(logged_request["linked_message"]["kind"], "email");
    assert_eq!(logged_request["linked_message"]["id"], created_email["id"]);
    assert_eq!(
        logged_request["request_headers"]["authorization"],
        "Bearer ********"
    );
}

#[tokio::test]
async fn reading_the_api_is_not_logged() {
    let app_router = build_router();
    let request = Request::get("/api/v1/emails")
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"));

    send_request(&app_router, request).await;

    assert_eq!(
        list_logged_requests(&app_router, "").await["total_count"],
        0
    );
}
