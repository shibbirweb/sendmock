use std::sync::{Arc, OnceLock};

use axum::http::{Method, Uri};
use axum::routing::{MethodRouter, get};
use axum::{Json, Router};
use sendmock_ops::ai::{render_llms_full_text, render_llms_text};
use sendmock_ops::{OperationContext, OperationRegistry};
use serde_json::Value;

use crate::catch_routes::build_catch_router;
use crate::mailpit_routes::build_mailpit_router;
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

/// Plain text for agents that browse, rendered from the registry on the first request and
/// kept, so a server nobody asks for it holds no copy at idle.
fn serve_text(render_text: impl Fn() -> String + Send + Sync + 'static) -> MethodRouter {
    let rendered_text = Arc::new(OnceLock::new());
    let render_text = Arc::new(render_text);
    get(move || {
        let rendered_text = Arc::clone(&rendered_text);
        let render_text = Arc::clone(&render_text);
        async move {
            (
                [(
                    axum::http::header::CONTENT_TYPE,
                    "text/plain; charset=utf-8",
                )],
                rendered_text.get_or_init(|| render_text()).clone(),
            )
        }
    })
}

/// The OpenAPI document, built on the first request and kept: it is the largest thing the
/// server would otherwise hold from the start.
fn serve_openapi_document(
    operation_registry: OperationRegistry,
    version: &'static str,
) -> MethodRouter {
    let openapi_document: Arc<OnceLock<Value>> = Arc::new(OnceLock::new());
    let operation_registry = Arc::new(operation_registry);
    get(move || {
        let openapi_document = Arc::clone(&openapi_document);
        let operation_registry = Arc::clone(&operation_registry);
        async move {
            Json(
                openapi_document
                    .get_or_init(|| build_openapi_document(&operation_registry, version))
                    .clone(),
            )
        }
    })
}

/// The whole HTTP surface: the REST API, its OpenAPI document, `/llms.txt`, the provider APIs under
/// `/providers/<key>/`, Mailpit's API paths, and the web UI for every other path.
pub fn build_app_router(
    operation_registry: &OperationRegistry,
    operation_context: &OperationContext,
    ui_assets: Arc<dyn UiAssets>,
) -> Router {
    let version = operation_context.instance_details.version;
    let llms_text_registry = operation_registry.clone();
    let llms_full_text_registry = operation_registry.clone();
    build_rest_router(operation_registry, operation_context)
        .merge(build_realtime_router(operation_context))
        .merge(build_provider_router(operation_context))
        .merge(build_catch_router(operation_context))
        .merge(build_mailpit_router(operation_context))
        .route(
            OPENAPI_DOCUMENT_PATH,
            serve_openapi_document(operation_registry.clone(), version),
        )
        .route(
            LLMS_TEXT_PATH,
            serve_text(move || render_llms_text(version, &llms_text_registry)),
        )
        .route(
            LLMS_FULL_TEXT_PATH,
            serve_text(move || render_llms_full_text(version, &llms_full_text_registry)),
        )
        .fallback(move |method: Method, uri: Uri| async move {
            serve_ui_path(ui_assets.as_ref(), &method, &uri)
        })
}
