use std::sync::Arc;

use axum::Router;
use axum::http::{Method, Uri};
use sendmock_ops::{OperationContext, OperationRegistry};

use crate::rest_router::build_rest_router;
use crate::ui_assets::UiAssets;
use crate::ui_router::serve_ui_path;

/// The whole HTTP surface: the REST API, and the web UI for every other path.
pub fn build_app_router(
    operation_registry: &OperationRegistry,
    operation_context: &OperationContext,
    ui_assets: Arc<dyn UiAssets>,
) -> Router {
    build_rest_router(operation_registry, operation_context).fallback(
        move |method: Method, uri: Uri| async move { serve_ui_path(ui_assets.as_ref(), &method, &uri) },
    )
}
