//! `/catch/<bin>/...`: every method is captured in the bin and answered with its reply
//! (HC-01.1). The catch-all port does the same at any path, the first segment naming the bin
//! (HC-01.4).

use std::collections::BTreeMap;
use std::net::SocketAddr;

use axum::Router;
use axum::body::{Body, to_bytes};
use axum::extract::{ConnectInfo, Request, State};
use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::any;
use sendmock_ops::{IncomingHttpRequest, OperationContext, capture_http_request};

use crate::api_error_response::ApiErrorResponse;

/// Captured bodies larger than this are refused before they are read.
const MAXIMUM_CAPTURED_BODY_BYTES: usize = 32 * 1024 * 1024;

pub fn build_catch_router(operation_context: &OperationContext) -> Router {
    Router::new()
        .route("/catch/{*bin_path}", any(capture_request))
        .with_state(operation_context.clone())
}

/// The router of `--catcher-addr`: every request, at any method and path, is captured.
pub fn build_catch_all_router(operation_context: &OperationContext) -> Router {
    Router::new()
        .fallback(capture_request_at_any_path)
        .with_state(operation_context.clone())
}

/// On the catch-all port the first path segment names the bin, so `/orders/new` is
/// `/catch/orders/new` and `/` is the `default` bin.
fn to_catch_path(request_path: &str) -> String {
    let path_after_slash = request_path.trim_start_matches('/');
    if path_after_slash.is_empty() {
        return "/catch/default".to_owned();
    }
    format!("/catch/{path_after_slash}")
}

async fn capture_request_at_any_path(
    State(operation_context): State<OperationContext>,
    request: Request,
) -> Response {
    let catch_path = to_catch_path(request.uri().path());
    capture_into_bin(operation_context, request, catch_path).await
}

async fn capture_request(
    State(operation_context): State<OperationContext>,
    request: Request,
) -> Response {
    let catch_path = request.uri().path().to_owned();
    capture_into_bin(operation_context, request, catch_path).await
}

/// Captures the request in the bin `catch_path` names; the stored URL is the one the app used.
async fn capture_into_bin(
    operation_context: OperationContext,
    request: Request,
    catch_path: String,
) -> Response {
    let client_ip = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map_or_else(
            || "127.0.0.1".to_owned(),
            |connect_info| connect_info.0.ip().to_string(),
        );
    let (request_parts, request_body) = request.into_parts();
    let Ok(body_bytes) = to_bytes(request_body, MAXIMUM_CAPTURED_BODY_BYTES).await else {
        return StatusCode::PAYLOAD_TOO_LARGE.into_response();
    };
    let headers: BTreeMap<String, String> = request_parts
        .headers
        .iter()
        .map(|(header_name, header_value)| {
            (
                header_name.as_str().to_ascii_lowercase(),
                header_value.to_str().unwrap_or_default().to_owned(),
            )
        })
        .collect();
    let host = headers
        .get("host")
        .cloned()
        .unwrap_or_else(|| "localhost".to_owned());
    let incoming_request = IncomingHttpRequest {
        method: request_parts.method.as_str().to_owned(),
        url: format!("http://{host}{}", request_parts.uri),
        path: catch_path,
        query_string: request_parts.uri.query().map(str::to_owned),
        headers,
        body: body_bytes.to_vec(),
        client_ip,
    };
    match capture_http_request(&operation_context, incoming_request).await {
        Ok(catch_answer) => {
            if catch_answer.delay_ms > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(u64::from(
                    catch_answer.delay_ms,
                )))
                .await;
            }
            build_catch_response(&catch_answer.response)
        }
        Err(operation_error) => ApiErrorResponse::from(operation_error).into_response(),
    }
}

fn build_catch_response(mock_response: &sendmock_ops::HttpMockResponse) -> Response {
    let mut response = Response::new(Body::from(mock_response.body.clone()));
    *response.status_mut() =
        StatusCode::from_u16(mock_response.status_code).unwrap_or(StatusCode::OK);
    for (header_name, header_value) in &mock_response.headers {
        if let (Ok(header_name), Ok(header_value)) = (
            HeaderName::from_bytes(header_name.as_bytes()),
            HeaderValue::from_str(header_value),
        ) {
            response.headers_mut().insert(header_name, header_value);
        }
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: HC-01.4
    #[test]
    fn the_first_path_segment_names_the_bin_on_the_catch_all_port() {
        assert_eq!(to_catch_path("/orders/new"), "/catch/orders/new");
        assert_eq!(to_catch_path("/orders"), "/catch/orders");
        assert_eq!(to_catch_path("/"), "/catch/default");
        assert_eq!(to_catch_path(""), "/catch/default");
    }
}
