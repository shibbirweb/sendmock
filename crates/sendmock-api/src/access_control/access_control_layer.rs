use axum::Router;
use axum::extract::{Request, State};
use axum::http::header::{AUTHORIZATION, WWW_AUTHENTICATE};
use axum::http::{HeaderValue, Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use tower_http::cors::{AllowOrigin, CorsLayer};

use super::ui_auth::UiAuth;

/// Liveness stays open, so container health checks work with auth on; it reveals nothing.
const UNPROTECTED_PATHS: [&str; 1] = ["/api/v1/health"];
/// Provider APIs carry the provider's own credentials (Twilio sends Basic auth), checked by
/// the provider's definition, so they cannot also carry SendMock's.
const PROVIDER_PATH_PREFIX: &str = "/providers/";

/// Who may reach the server, and from which browser origins.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AccessControlSettings {
    /// `None` leaves everything open, as on a developer's machine.
    pub ui_auth: Option<UiAuth>,
    /// Origins whose pages may call the API, such as the docs site's playground.
    pub cors_origins: Vec<String>,
}

/// Wraps the whole router: CORS first, so preflights are answered without credentials,
/// then UI auth over the UI, the API, the realtime streams and `/mcp` (PL-06.2, PL-06.4).
pub fn apply_access_control(
    router: Router,
    access_control_settings: AccessControlSettings,
) -> Router {
    let router = match access_control_settings.ui_auth {
        Some(ui_auth) => router.layer(middleware::from_fn_with_state(ui_auth, require_ui_auth)),
        None => router,
    };
    match build_cors_layer(&access_control_settings.cors_origins) {
        Some(cors_layer) => router.layer(cors_layer),
        None => router,
    }
}

async fn require_ui_auth(State(ui_auth): State<UiAuth>, request: Request, next: Next) -> Response {
    let request_path = request.uri().path();
    let is_unprotected = request.method() == Method::OPTIONS
        || UNPROTECTED_PATHS.contains(&request_path)
        || request_path.starts_with(PROVIDER_PATH_PREFIX);
    let is_authorized = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|header_value| header_value.to_str().ok())
        .is_some_and(|authorization_header| ui_auth.accepts_authorization(authorization_header));
    if is_unprotected || is_authorized {
        return next.run(request).await;
    }
    (
        StatusCode::UNAUTHORIZED,
        [(WWW_AUTHENTICATE, HeaderValue::from_static("Basic realm=\"SendMock\", charset=\"UTF-8\""))],
        axum::Json(serde_json::json!({
            "error": { "code": "unauthorized", "message": "Sign in with the UI auth user or send the API token" },
        })),
    )
        .into_response()
}

/// `None` when no origin is allowed, so no CORS headers are sent at all. Browsers ask
/// before a public page calls a local address, so preflights allow private networks.
fn build_cors_layer(cors_origins: &[String]) -> Option<CorsLayer> {
    let allowed_origins: Vec<HeaderValue> = cors_origins
        .iter()
        .filter_map(|origin| HeaderValue::from_str(origin.trim().trim_end_matches('/')).ok())
        .collect();
    if allowed_origins.is_empty() {
        return None;
    }
    Some(
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(allowed_origins))
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::PATCH,
                Method::DELETE,
            ])
            .allow_headers([
                AUTHORIZATION,
                axum::http::header::CONTENT_TYPE,
                axum::http::header::ACCEPT,
            ])
            .allow_private_network(true),
    )
}
