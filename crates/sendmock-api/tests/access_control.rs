#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::{Request, Response};
use sendmock_api::{AccessControlSettings, UiAuth, apply_access_control};
use support::test_app::build_test_app;
use tower::ServiceExt;

const DOCS_ORIGIN: &str = "https://shibbirweb.github.io";
/// `admin:s3cret`, as a browser sends it after the sign-in prompt.
const ADMIN_BASIC_AUTH: &str = "Basic YWRtaW46czNjcmV0";

fn protected_router() -> axum::Router {
    let (app_router, _) = build_test_app();
    let ui_auth = UiAuth::from_setting("admin:s3cret", Some("tok_123".to_owned()))
        .unwrap_or_else(|auth_error| panic!("{auth_error}"));
    apply_access_control(
        app_router,
        AccessControlSettings {
            ui_auth: Some(ui_auth),
            cors_origins: vec![DOCS_ORIGIN.to_owned()],
        },
    )
}

async fn send(router: &axum::Router, request: Request<Body>) -> Response<Body> {
    router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"))
}

fn get(path: &str, authorization: Option<&str>) -> Request<Body> {
    let mut request_builder = Request::get(path);
    if let Some(authorization) = authorization {
        request_builder = request_builder.header("authorization", authorization);
    }
    request_builder
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"))
}

// AC: PL-06.2
#[tokio::test]
async fn with_ui_auth_the_ui_the_api_and_the_realtime_streams_need_credentials() {
    let router = protected_router();

    for path in [
        "/",
        "/mail",
        "/api/v1/emails",
        "/api/v1/events",
        "/api/v1/ws",
    ] {
        let response = send(&router, get(path, None)).await;
        assert_eq!(response.status(), 401, "{path}");
        assert!(
            response.headers().contains_key("www-authenticate"),
            "{path}"
        );
    }
}

// AC: PL-06.2
#[tokio::test]
async fn the_user_and_password_or_the_api_token_get_in() {
    let router = protected_router();

    let with_password = send(&router, get("/api/v1/emails", Some(ADMIN_BASIC_AUTH))).await;
    let with_token = send(&router, get("/api/v1/emails", Some("Bearer tok_123"))).await;
    let with_wrong_token = send(&router, get("/api/v1/emails", Some("Bearer nope"))).await;

    assert_eq!(with_password.status(), 200);
    assert_eq!(with_token.status(), 200);
    assert_eq!(with_wrong_token.status(), 401);
}

#[tokio::test]
async fn health_stays_open_for_container_checks() {
    assert_eq!(
        send(&protected_router(), get("/api/v1/health", None))
            .await
            .status(),
        200
    );
}

fn preflight(origin: &str) -> Request<Body> {
    Request::builder()
        .method("OPTIONS")
        .uri("/api/v1/emails")
        .header("origin", origin)
        .header("access-control-request-method", "GET")
        .header("access-control-request-headers", "authorization")
        .header("access-control-request-private-network", "true")
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"))
}

// AC: PL-06.4
#[tokio::test]
async fn only_the_configured_origins_may_call_the_api_from_a_browser() {
    let router = protected_router();

    let docs_preflight = send(&router, preflight(DOCS_ORIGIN)).await;
    let other_preflight = send(&router, preflight("https://evil.example")).await;

    assert_eq!(
        docs_preflight
            .headers()
            .get("access-control-allow-origin")
            .and_then(|value| value.to_str().ok()),
        Some(DOCS_ORIGIN)
    );
    assert_eq!(
        docs_preflight
            .headers()
            .get("access-control-allow-private-network")
            .and_then(|value| value.to_str().ok()),
        Some("true")
    );
    assert!(
        other_preflight
            .headers()
            .get("access-control-allow-origin")
            .is_none()
    );
}

// AC: PL-06.4
#[tokio::test]
async fn an_empty_origin_list_turns_cors_off() {
    let (app_router, _) = build_test_app();
    let open_router = apply_access_control(app_router, AccessControlSettings::default());

    let docs_preflight = send(&open_router, preflight(DOCS_ORIGIN)).await;

    assert!(
        docs_preflight
            .headers()
            .get("access-control-allow-origin")
            .is_none()
    );
}
