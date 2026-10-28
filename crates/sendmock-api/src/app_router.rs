use std::sync::Arc;

use axum::http::{Method, Uri};
use axum::routing::get;
use axum::{Json, Router};
use sendmock_ops::{OperationContext, OperationRegistry};

use crate::openapi_document::build_openapi_document;
use crate::rest_router::build_rest_router;
use crate::ui_assets::UiAssets;
use crate::ui_router::serve_ui_path;

/// Where the generated OpenAPI document is served; outside `/api/v1`, like other API metadata.
pub const OPENAPI_DOCUMENT_PATH: &str = "/api/openapi.json";

/// The whole HTTP surface: the REST API, its OpenAPI document, and the web UI for every
/// other path.
pub fn build_app_router(
    operation_registry: &OperationRegistry,
    operation_context: &OperationContext,
    ui_assets: Arc<dyn UiAssets>,
) -> Router {
    let openapi_document = Arc::new(build_openapi_document(
        operation_registry,
        operation_context.instance_details.version,
    ));
    build_rest_router(operation_registry, operation_context)
        .route(
            OPENAPI_DOCUMENT_PATH,
            get(move || async move { Json(openapi_document.as_ref().clone()) }),
        )
        .fallback(move |method: Method, uri: Uri| async move {
            serve_ui_path(ui_assets.as_ref(), &method, &uri)
        })
}
