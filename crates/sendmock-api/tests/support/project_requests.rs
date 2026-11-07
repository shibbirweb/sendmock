//! Requests that name their project, and the projects they need.

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use tower::ServiceExt;

use super::test_app::call_api;

/// A JSON `POST` that names its project in `X-SendMock-Project`.
pub async fn post_in_project(
    app_router: &axum::Router,
    path: &str,
    json_body: &Value,
    project_key: &str,
) -> (u16, Value) {
    let request = Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", "application/json")
        .header("x-sendmock-project", project_key)
        .body(Body::from(json_body.to_string()))
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

pub async fn create_project(app_router: &axum::Router, project_key: &str) {
    let (status, created) = call_api(
        app_router,
        "POST",
        "/api/v1/projects",
        Some(&json!({ "key": project_key, "name": project_key })),
    )
    .await;
    assert_eq!(status, 201, "{created}");
}
