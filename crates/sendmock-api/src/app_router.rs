use std::sync::Arc;

use axum::http::{Method, Uri};
use axum::routing::get;
use axum::{Json, Router};
use sendmock_ops::ai::{render_llms_full_text, render_llms_text};
use sendmock_ops::{OperationContext, OperationRegistry};

use crate::catch_routes::build_catch_router;
use crate::openapi_document::build_openapi_document;
use crate::provider_routes::build_provider_router;
use crate::realtime::build_realtime_router;
use crate::rest_router::build_rest_router;
use crate::ui_assets::UiAssets;
use crate::ui_router::serve_ui_path;

/// Where the generated OpenAPI document is served; outside `/api/v1`, like other API metadata.
pub const OPENAPI_DOCUMENT_PATH: &str = "/api/openapi.json";
const LLMS_TEXT_PATH: &str = "/llms.txt";
const LLMS_FULL_TEXT_PATH: &str = "/llms-full.txt";

/// Plain text for agents that browse, rendered once from the registry.
fn serve_text(text: String) -> axum::routing::MethodRouter {
    let shared_text = Arc::new(text);
    get(move || {
        let shared_text = Arc::clone(&shared_text);
        async move {
            (
                [(
                    axum::http::header::CONTENT_TYPE,
                    "text/plain; charset=utf-8",
                )],
                shared_text.as_ref().clone(),
            )
        }
    })
}

/// The whole HTTP surface: the REST API, its OpenAPI document, `/llms.txt`, the provider APIs under
/// `/providers/<key>/`, and the web UI for every other path.
pub fn build_app_router(
    operation_registry: &OperationRegistry,
    operation_context: &OperationContext,
    ui_assets: Arc<dyn UiAssets>,
) -> Router {
    let version = operation_context.instance_details.version;
    let openapi_document = Arc::new(build_openapi_document(operation_registry, version));
    build_rest_router(operation_registry, operation_context)
        .merge(build_realtime_router(operation_context))
        .merge(build_provider_router(operation_context))
        .merge(build_catch_router(operation_context))
        .route(
            OPENAPI_DOCUMENT_PATH,
            get(move || async move { Json(openapi_document.as_ref().clone()) }),
        )
        .route(
            LLMS_TEXT_PATH,
            serve_text(render_llms_text(version, operation_registry)),
        )
        .route(
            LLMS_FULL_TEXT_PATH,
            serve_text(render_llms_full_text(version, operation_registry)),
        )
        .fallback(move |method: Method, uri: Uri| async move {
            serve_ui_path(ui_assets.as_ref(), &method, &uri)
        })
}
