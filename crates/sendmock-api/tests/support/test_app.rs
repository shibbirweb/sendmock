use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use sendmock_api::{EmbeddedUiAssets, build_app_router};
use sendmock_core::{FixedClock, SystemIdGenerator};
use sendmock_ops::{InstanceDetails, OperationContext, ReleaseChannel, build_operation_registry};
use sendmock_store::{Database, DatabaseLocation, EMBEDDED_MIGRATIONS};
use serde_json::Value;
use tower::ServiceExt;

/// The whole HTTP surface over a fresh in-memory database, with its context for direct checks.
pub fn build_test_app() -> (axum::Router, OperationContext) {
    build_test_app_with(|operation_context| operation_context)
}

/// Like `build_test_app`, with fakes such as a status callback sender put into the context.
pub fn build_test_app_with(
    configure_context: impl FnOnce(OperationContext) -> OperationContext,
) -> (axum::Router, OperationContext) {
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
    let operation_context = configure_context(operation_context);
    let app_router = build_app_router(
        &build_operation_registry(),
        &operation_context,
        Arc::new(EmbeddedUiAssets),
    );
    (app_router, operation_context)
}

/// Sends a request with an optional JSON body; answers the status and the body as JSON
/// (`null` when it is empty or not JSON).
pub async fn call_api(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    json_body: Option<&Value>,
) -> (u16, Value) {
    let request = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json")
        .body(json_body.map_or_else(Body::empty, |json_body| Body::from(json_body.to_string())))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
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
