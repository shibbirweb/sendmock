//! The HTTP server: REST routes from the operation registry, realtime streams, OpenAPI and the embedded UI.

mod api_error_response;
mod app_router;
mod http_server;
mod openapi_document;
mod rest_router;
mod ui_assets;
mod ui_router;

#[cfg(test)]
mod test_support;

pub use app_router::build_app_router;
pub use http_server::serve_http;
pub use openapi_document::build_openapi_document;
pub use ui_assets::{EmbeddedUiAssets, UiAsset, UiAssets};
