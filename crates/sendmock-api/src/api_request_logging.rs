use std::time::Instant;

use axum::body::{Body, to_bytes};
use axum::extract::{Request, State};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use sendmock_ops::{CompletedApiRequest, OperationContext, RequestLogSettings, record_api_request};

use crate::api_error_response::ApiErrorResponse;

/// Bodies larger than this are refused before they are read, as the REST routes do.
const MAXIMUM_REQUEST_BODY_BYTES: usize = 32 * 1024 * 1024;

/// Wraps a logged operation's route: reads the request and the response it gets, stores the
/// pair in the API request log, then answers exactly what the operation answered.
pub async fn log_api_request(
    State((operation_context, request_log_settings)): State<(OperationContext, RequestLogSettings)>,
    request: Request,
    next: Next,
) -> Response {
    let started_at = Instant::now();
    let (request_parts, request_body) = request.into_parts();
    let Ok(request_bytes) = to_bytes(request_body, MAXIMUM_REQUEST_BODY_BYTES).await else {
        return ApiErrorResponse::invalid_json_body("the request body is too large or unreadable")
            .into_response();
    };
    let method = request_parts.method.to_string();
    let path = request_parts.uri.path_and_query().map_or_else(
        || request_parts.uri.path().to_owned(),
        |path_and_query| path_and_query.as_str().to_owned(),
    );
    let request_headers = request_parts
        .headers
        .iter()
        .map(|(header_name, header_value)| {
            (
                header_name.as_str().to_owned(),
                String::from_utf8_lossy(header_value.as_bytes()).into_owned(),
            )
        })
        .collect();
    let response = next
        .run(Request::from_parts(
            request_parts,
            Body::from(request_bytes.clone()),
        ))
        .await;
    let (response_parts, response_body) = response.into_parts();
    let response_bytes = to_bytes(response_body, usize::MAX)
        .await
        .unwrap_or_default();
    let completed_request = CompletedApiRequest {
        method,
        path,
        request_headers,
        request_body: request_bytes.to_vec(),
        response_status: response_parts.status.as_u16(),
        response_body: response_bytes.to_vec(),
        duration_ms: u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX),
    };
    if let Err(record_error) =
        record_api_request(&operation_context, request_log_settings, completed_request).await
    {
        tracing::warn!(error = %record_error, "could not record an API request");
    }
    Response::from_parts(response_parts, Body::from(response_bytes))
}
