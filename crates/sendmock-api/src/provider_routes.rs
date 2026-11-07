use std::time::Instant;

use axum::Router;
use axum::body::{Body, to_bytes};
use axum::extract::{Path, Request, State};
use axum::http::{HeaderMap, HeaderName, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::any;
use sendmock_ops::{
    CompletedApiRequest, OperationContext, PROJECT_HEADER, ProviderHttpRequest, ProviderOutcome,
    ProviderRequestLogEntry, ProviderRoute, answer_provider_request, find_named_project,
    find_whatsapp_media_download, record_provider_request,
};

use crate::api_error_response::ApiErrorResponse;
use crate::request_body_decoding::decode_request_body;

/// Provider requests larger than this are refused before they are read, as the REST routes do.
const MAXIMUM_REQUEST_BODY_BYTES: usize = 32 * 1024 * 1024;

/// `/providers/<key>/<the provider's real path>` on the main port.
pub fn build_provider_router(operation_context: &OperationContext) -> Router {
    Router::new()
        .route(
            "/providers/{provider_key}/{*provider_path}",
            any(answer_prefixed_provider_request),
        )
        // A catch-all takes no empty path, and APIs such as Amazon SNS's post to `/` itself.
        .route(
            "/providers/{provider_key}/",
            any(answer_prefixed_root_request),
        )
        .route(
            "/providers/{provider_key}",
            any(answer_prefixed_root_request),
        )
        .with_state(operation_context.clone())
}

async fn answer_prefixed_root_request(
    State(operation_context): State<OperationContext>,
    Path(provider_key): Path<String>,
    request: Request,
) -> Response {
    answer_provider_http_request(
        &operation_context,
        ProviderRoute::Prefixed(&provider_key),
        "/".to_owned(),
        request,
    )
    .await
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

/// The body as the provider reads it, inflated when gzipped; `None` when it is too large or
/// unreadable.
async fn read_request_bytes(headers: &HeaderMap, request_body: Body) -> Option<Vec<u8>> {
    let request_bytes = to_bytes(request_body, MAXIMUM_REQUEST_BODY_BYTES)
        .await
        .ok()?;
    decode_request_body(headers, request_bytes.to_vec(), MAXIMUM_REQUEST_BODY_BYTES)
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
    let (path_project, provider_path) = split_project_prefix(provider_path);
    let project_context =
        match pick_project_context(operation_context, path_project, &request_parts.headers).await {
            Ok(project_context) => project_context,
            Err(error_response) => return error_response.into_response(),
        };
    let operation_context = project_context.as_ref().unwrap_or(operation_context);
    let Some(request_bytes) = read_request_bytes(&request_parts.headers, request_body).await else {
        return ApiErrorResponse::invalid_json_body("the request body is too large or unreadable")
            .into_response();
    };
    let request_headers = read_request_headers(&request_parts.headers);
    let provider_request = ProviderHttpRequest {
        method: request_parts.method.to_string(),
        path: provider_path,
        query_string: request_parts.uri.query().map(str::to_owned),
        headers: request_headers.iter().cloned().collect(),
        body: request_bytes,
    };
    match find_whatsapp_media_download(operation_context, &provider_request).await {
        Ok(Some((mime_type, media_content))) => {
            return build_media_response(&mime_type, media_content);
        }
        Ok(None) => {}
        Err(operation_error) => return ApiErrorResponse::from(operation_error).into_response(),
    }
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

/// A file the WhatsApp Cloud API's download link serves: bytes, which provider answers (text)
/// cannot carry.
fn build_media_response(mime_type: &str, media_content: Vec<u8>) -> Response {
    let content_type = HeaderValue::try_from(mime_type)
        .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream"));
    let mut response = Response::new(Body::from(media_content));
    response
        .headers_mut()
        .insert(axum::http::header::CONTENT_TYPE, content_type);
    response
}

/// The request's headers as text, for the provider runtime and the request log.
fn read_request_headers(headers: &HeaderMap) -> Vec<(String, String)> {
    headers
        .iter()
        .map(|(header_name, header_value)| {
            (
                header_name.as_str().to_owned(),
                String::from_utf8_lossy(header_value.as_bytes()).into_owned(),
            )
        })
        .collect()
}

/// `/projects/<key>/<the provider's path>`: the project for SDKs that take a base URL but
/// cannot add a header. Answers the project named, if any, and the provider's own path.
fn split_project_prefix(provider_path: String) -> (Option<String>, String) {
    let Some(project_and_path) = provider_path.strip_prefix("/projects/") else {
        return (None, provider_path);
    };
    let (project_name, rest_of_path) = project_and_path
        .split_once('/')
        .unwrap_or((project_and_path, ""));
    (Some(project_name.to_owned()), format!("/{rest_of_path}"))
}

/// The context for a request that names a project, by URL prefix or `X-SendMock-Project`;
/// `None` keeps the shared context (`default`). An unknown project is refused.
async fn pick_project_context(
    operation_context: &OperationContext,
    path_project: Option<String>,
    headers: &HeaderMap,
) -> Result<Option<OperationContext>, ApiErrorResponse> {
    let header_project = headers
        .get(PROJECT_HEADER)
        .and_then(|header_value| header_value.to_str().ok())
        .map(str::trim)
        .filter(|header_value| !header_value.is_empty());
    let Some(project_name) = path_project.as_deref().or(header_project) else {
        return Ok(None);
    };
    let project_key = find_named_project(operation_context, Some(project_name))
        .await?
        .ok_or_else(|| ApiErrorResponse::unknown_project(project_name))?;
    Ok(Some(
        operation_context.clone().with_project_key(&project_key),
    ))
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
        created_message: provider_outcome.created_message.clone(),
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
