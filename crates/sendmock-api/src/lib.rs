//! The HTTP server: REST routes from the operation registry, realtime streams, OpenAPI and the embedded UI.

mod access_control;
mod api_error_response;
mod api_request_logging;
mod app_router;
mod http_server;
mod openapi_document;
mod provider_routes;
mod realtime;
mod request_input;
mod rest_router;
mod ui_assets;
mod ui_router;

#[cfg(test)]
mod test_support;

pub use access_control::{AccessControlSettings, UiAuth, UiAuthError, apply_access_control};
pub use app_router::build_app_router;
pub use http_server::serve_http;
pub use openapi_document::build_openapi_document;
pub use provider_routes::build_provider_port_router;
pub use ui_assets::{EmbeddedUiAssets, UiAsset, UiAssets};
