use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::http::{Method, StatusCode, Uri};
use axum::response::{IntoResponse, Response};

use crate::api_error_response::ApiErrorResponse;
use crate::ui_assets::{UiAsset, UiAssets};

const INDEX_PATH: &str = "index.html";
/// Vite puts content-hashed files here, so a browser may keep them forever.
const HASHED_ASSET_FOLDER: &str = "assets/";
const IMMUTABLE_CACHE: &str = "public, max-age=31536000, immutable";
const REVALIDATE_CACHE: &str = "no-cache";
const UI_NOT_BUILT_MESSAGE: &str =
    "The web UI is not built into this binary. Build it with `bun run build` in web/.";

/// Serves a UI file, or `index.html` for an app route such as `/mail`, so deep links work.
/// Unknown `/api/` paths get the API's JSON error instead.
pub fn serve_ui_path(ui_assets: &dyn UiAssets, method: &Method, uri: &Uri) -> Response {
    let request_path = uri.path();
    if request_path == "/api" || request_path.starts_with("/api/") {
        return ApiErrorResponse::unknown_route(method, request_path).into_response();
    }
    let asset_path = match request_path.trim_start_matches('/') {
        "" => INDEX_PATH,
        asset_path => asset_path,
    };
    if let Some(ui_asset) = ui_assets.find_asset(asset_path) {
        return asset_response(ui_asset, cache_policy_for(asset_path));
    }
    if asset_path == INDEX_PATH || is_app_route(asset_path) {
        if let Some(index_asset) = ui_assets.find_asset(INDEX_PATH) {
            return asset_response(index_asset, REVALIDATE_CACHE);
        }
        return (StatusCode::NOT_FOUND, UI_NOT_BUILT_MESSAGE).into_response();
    }
    StatusCode::NOT_FOUND.into_response()
}

/// A path whose last part has no file extension is a client-side route, not a file.
fn is_app_route(asset_path: &str) -> bool {
    let last_segment = asset_path.rsplit('/').next().unwrap_or_default();
    !last_segment.contains('.')
}

fn cache_policy_for(asset_path: &str) -> &'static str {
    if asset_path.starts_with(HASHED_ASSET_FOLDER) {
        IMMUTABLE_CACHE
    } else {
        REVALIDATE_CACHE
    }
}

fn asset_response(ui_asset: UiAsset, cache_policy: &'static str) -> Response {
    (
        [
            (CONTENT_TYPE, ui_asset.content_type),
            (CACHE_CONTROL, cache_policy.to_owned()),
        ],
        ui_asset.bytes.into_owned(),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use axum::body::to_bytes;

    use super::*;
    use crate::ui_assets::InMemoryUiAssets;

    fn built_ui() -> InMemoryUiAssets {
        InMemoryUiAssets::default()
            .with_asset(
                "index.html",
                "text/html",
                "<!doctype html><div id=\"root\"></div>",
            )
            .with_asset("assets/app-1a2b3c.js", "text/javascript", "console.log(1)")
            .with_asset("favicon.svg", "image/svg+xml", "<svg/>")
    }

    async fn read_text(response: Response) -> String {
        let body_bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap_or_default();
        String::from_utf8_lossy(&body_bytes).into_owned()
    }

    fn request(ui_assets: &dyn UiAssets, path: &str) -> Response {
        serve_ui_path(
            ui_assets,
            &Method::GET,
            &path.parse::<Uri>().unwrap_or_default(),
        )
    }

    fn header_value(response: &Response, header_name: axum::http::HeaderName) -> String {
        response
            .headers()
            .get(header_name)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .to_owned()
    }

    #[tokio::test]
    async fn serves_index_at_the_root_and_asks_browsers_to_revalidate_it() {
        let response = request(&built_ui(), "/");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header_value(&response, CACHE_CONTROL), REVALIDATE_CACHE);
        assert!(read_text(response).await.contains("id=\"root\""));
    }

    #[test]
    fn lets_browsers_keep_hashed_assets_forever() {
        let response = request(&built_ui(), "/assets/app-1a2b3c.js");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(header_value(&response, CONTENT_TYPE), "text/javascript");
        assert_eq!(header_value(&response, CACHE_CONTROL), IMMUTABLE_CACHE);
    }

    #[tokio::test]
    async fn answers_an_app_route_with_index_so_deep_links_work() {
        let response = request(&built_ui(), "/webhooks/endpoints");

        assert_eq!(response.status(), StatusCode::OK);
        assert!(read_text(response).await.contains("id=\"root\""));
    }

    #[test]
    fn a_missing_file_is_not_found_instead_of_index() {
        assert_eq!(
            request(&built_ui(), "/missing.png").status(),
            StatusCode::NOT_FOUND
        );
    }

    #[tokio::test]
    async fn an_unknown_api_path_gets_the_json_error() {
        let response = request(&built_ui(), "/api/v1/nothing-here");

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert!(read_text(response).await.contains("\"code\":\"not_found\""));
    }

    #[tokio::test]
    async fn says_how_to_build_the_ui_when_it_is_missing() {
        let response = request(&InMemoryUiAssets::default(), "/");

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert!(read_text(response).await.contains("bun run build"));
    }
}
