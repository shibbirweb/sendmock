//! A provider request answered by the provider's attached HTTP Catcher bin (PL-21.2).

use std::time::{Duration, Instant};

use axum::body::Body;
use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::Response;
use sendmock_ops::{
    CompletedApiRequest, HttpMockResponse, OperationContext, ProviderGapAnswer,
    ProviderHttpRequest, ProviderRequestLogEntry, record_provider_request,
};

/// The request as the provider route read it, for the log.
pub struct LoggedProviderRequest {
    pub provider_request: ProviderHttpRequest,
    /// The path and query as the client sent them.
    pub logged_path: String,
    pub request_headers: Vec<(String, String)>,
    pub started_at: Instant,
}

/// The attached bin's answer, after its rule's delay, logged under the provider with the bin
/// and rule that answered.
pub async fn answer_with_bin(
    operation_context: &OperationContext,
    gap_answer: ProviderGapAnswer,
    logged_request: LoggedProviderRequest,
) -> Response {
    let LoggedProviderRequest {
        provider_request,
        logged_path,
        request_headers,
        started_at,
    } = logged_request;
    if gap_answer.delay_ms > 0 {
        tokio::time::sleep(Duration::from_millis(u64::from(gap_answer.delay_ms))).await;
    }
    let completed_request = CompletedApiRequest {
        method: provider_request.method,
        path: logged_path,
        request_headers,
        request_body: provider_request.body,
        response_status: gap_answer.response.status_code,
        response_body: gap_answer.response.body.clone().into_bytes(),
        duration_ms: u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX),
    };
    let log_entry = ProviderRequestLogEntry {
        provider_key: gap_answer.provider_key,
        created_message: None,
        secret_values: Vec::new(),
        catcher_answer: Some(gap_answer.catcher_answer),
        note: None,
    };
    if let Err(record_error) =
        record_provider_request(operation_context, log_entry, completed_request).await
    {
        tracing::warn!(error = %record_error, "could not record a provider request");
    }
    build_bin_response(&gap_answer.response)
}

fn build_bin_response(mock_response: &HttpMockResponse) -> Response {
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
