use std::time::Instant;

use axum::Router;
use axum::body::{Body, to_bytes};
use axum::extract::{Path, Request, State};
use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::any;
use sendmock_ops::{
    CompletedApiRequest, OperationContext, ProviderHttpRequest, ProviderOutcome,
    ProviderRequestLogEntry, ProviderRoute, answer_provider_request, record_provider_request,
};

use crate::api_error_response::ApiErrorResponse;

/// Provider requests larger than this are refused before they are read, as the REST routes do.
const MAXIMUM_REQUEST_BODY_BYTES: usize = 32 * 1024 * 1024;

/// `/providers/<key>/<the provider's real path>` on the main port.
pub fn build_provider_router(operation_context: &OperationContext) -> Router {
    Router::new()
        .route(
            "/providers/{provider_key}/{*provider_path}",
            any(answer_prefixed_provider_request),
        )
        .with_state(operation_context.clone())
}

/// A provider port: every path is a provider's real path. With a provider key, only that
/// provider answers (`--provider-port twilio=8027`); without, every provider does, told apart
/// by path and then `Host`.
pub fn build_provider_port_router(
    operation_context: &OperationContext,
    dedicated_provider_key: Option<String>,
) -> Router {
    let operation_context = operation_context.clone();
    Router::new().fallback(move |request: Request| {
        let operation_context = operation_context.clone();
        let dedicated_provider_key = dedicated_provider_key.clone();
        async move {
            let provider_route = match dedicated_provider_key.as_deref() {
                Some(provider_key) => ProviderRoute::Prefixed(provider_key),
                None => ProviderRoute::ProviderPort,
            };
            let provider_path = request.uri().path().to_owned();
            answer_provider_http_request(&operation_context, provider_route, provider_path, request)
                .await
        }
    })
}

async fn answer_prefixed_provider_request(
    State(operation_context): State<OperationContext>,
    Path((provider_key, provider_path)): Path<(String, String)>,
    request: Request,
) -> Response {
    answer_provider_http_request(
        &operation_context,
        ProviderRoute::Prefixed(&provider_key),
        format!("/{provider_path}"),
        request,
    )
    .await
}

/// Answers a provider request, records it in the API request log under the provider's key,
/// and answers exactly what the provider would.
pub async fn answer_provider_http_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    provider_path: String,
    request: Request,
) -> Response {
    let started_at = Instant::now();
    let (request_parts, request_body) = request.into_parts();
    let Ok(request_bytes) = to_bytes(request_body, MAXIMUM_REQUEST_BODY_BYTES).await else {
        return ApiErrorResponse::invalid_json_body("the request body is too large or unreadable")
            .into_response();
    };
    let request_headers: Vec<(String, String)> = request_parts
        .headers
        .iter()
        .map(|(header_name, header_value)| {
            (
                header_name.as_str().to_owned(),
                String::from_utf8_lossy(header_value.as_bytes()).into_owned(),
            )
        })
        .collect();
    let provider_request = ProviderHttpRequest {
        method: request_parts.method.to_string(),
        path: provider_path,
        query_string: request_parts.uri.query().map(str::to_owned),
        headers: request_headers.iter().cloned().collect(),
        body: request_bytes.to_vec(),
    };
    let provider_outcome =
        match answer_provider_request(operation_context, provider_route, &provider_request).await {
            Ok(provider_outcome) => provider_outcome,
            Err(operation_error) => return ApiErrorResponse::from(operation_error).into_response(),
        };
    let completed_request = CompletedApiRequest {
        method: provider_request.method,
        path: request_parts.uri.path_and_query().map_or_else(
            || request_parts.uri.path().to_owned(),
            |path_and_query| path_and_query.as_str().to_owned(),
        ),
        request_headers,
        request_body: provider_request.body,
        response_status: provider_outcome.response.status,
        response_body: provider_outcome.response.body.clone().into_bytes(),
        duration_ms: u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX),
    };
    record_outcome(operation_context, &provider_outcome, completed_request).await;
    build_http_response(provider_outcome)
}

async fn record_outcome(
    operation_context: &OperationContext,
    provider_outcome: &ProviderOutcome,
    completed_request: CompletedApiRequest,
) {
    let log_entry = ProviderRequestLogEntry {
        provider_key: provider_outcome
            .provider_key
            .clone()
            .unwrap_or_else(|| "unknown".to_owned()),
        created_sms_id: provider_outcome.created_sms_id.clone(),
        secret_values: provider_outcome.secret_values.clone(),
    };
    if let Err(record_error) =
        record_provider_request(operation_context, log_entry, completed_request).await
    {
        tracing::warn!(error = %record_error, "could not record a provider request");
    }
}

fn build_http_response(provider_outcome: ProviderOutcome) -> Response {
    let provider_response = provider_outcome.response;
    let mut response = Response::new(Body::from(provider_response.body));
    *response.status_mut() =
        StatusCode::from_u16(provider_response.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    for (header_name, header_value) in provider_response.headers {
        if let (Ok(header_name), Ok(header_value)) = (
            HeaderName::try_from(header_name),
            HeaderValue::try_from(header_value),
        ) {
            response.headers_mut().insert(header_name, header_value);
        }
    }
    response
}
