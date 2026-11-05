//! Records a request to `/catch/<bin>/...` and answers it as the bin says (HC-01.1).

use std::collections::BTreeMap;

use sendmock_store::{CapturedFileRecord, CapturedRequestRecord, HttpBinRecord};
use serde_json::json;

use super::http_bin_presets::plain_default_response;
use super::http_catcher_wire::HttpMockResponse;
use crate::providers::{ProviderHttpRequest, read_provider_form_files};
use crate::{AppEventType, OperationContext, OperationError, publish_event};

/// A request as the catch route received it.
#[derive(Debug, Clone)]
pub struct IncomingHttpRequest {
    pub method: String,
    /// The full URL the client called.
    pub url: String,
    pub path: String,
    pub query_string: Option<String>,
    /// Names in lowercase.
    pub headers: BTreeMap<String, String>,
    pub body: Vec<u8>,
    pub client_ip: String,
}

/// What the catch route sends back.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CatchAnswer {
    pub request_id: String,
    pub response: HttpMockResponse,
}

/// `/catch/<bin>/...` names the bin; anything else is the `default` bin.
pub fn read_bin_name(path: &str) -> String {
    let mut segments = path.split('/').skip(1);
    match (segments.next(), segments.next()) {
        (Some("catch"), Some(bin_segment)) if !bin_segment.is_empty() => bin_segment.to_owned(),
        _ => "default".to_owned(),
    }
}

/// The bin of that name, created on first use without a preset.
pub async fn find_or_create_bin(
    operation_context: &OperationContext,
    bin_name: &str,
) -> Result<HttpBinRecord, OperationError> {
    let http_bins = &operation_context.http_catcher_stores.bins;
    if let Some(existing_bin) = http_bins.find_bin_by_name(bin_name).await? {
        return Ok(existing_bin);
    }
    let new_bin = HttpBinRecord {
        bin_id: operation_context.id_generator.generate_id().to_string(),
        name: bin_name.to_owned(),
        preset: None,
        default_response_json: serde_json::to_string(&plain_default_response())
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?,
        rules_json: "[]".to_owned(),
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
        request_count: 0,
        last_request_at_unix_ms: None,
    };
    Ok(http_bins.insert_bin_once(new_bin).await?)
}

fn read_uploaded_files(incoming_request: &IncomingHttpRequest) -> Vec<CapturedFileRecord> {
    let provider_request = ProviderHttpRequest {
        method: incoming_request.method.clone(),
        path: incoming_request.path.clone(),
        query_string: incoming_request.query_string.clone(),
        headers: incoming_request.headers.clone(),
        body: incoming_request.body.clone(),
    };
    read_provider_form_files(&provider_request)
        .into_iter()
        .zip(0_u32..)
        .map(|(form_part, file_index)| CapturedFileRecord {
            file_index,
            field_name: form_part.field_name,
            filename: form_part.file_name.unwrap_or_default(),
            content_type: form_part
                .content_type
                .unwrap_or_else(|| "application/octet-stream".to_owned()),
            size_bytes: u64::try_from(form_part.content.len()).unwrap_or_default(),
            content: form_part.content,
        })
        .collect()
}

fn read_query(query_string: Option<&str>) -> BTreeMap<String, String> {
    serde_urlencoded::from_str::<Vec<(String, String)>>(query_string.unwrap_or_default())
        .unwrap_or_default()
        .into_iter()
        .collect()
}

fn write_json(value: &impl serde::Serialize) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "{}".to_owned())
}

/// Stores the request with the bin's answer and fires `http.captured`.
pub async fn capture_http_request(
    operation_context: &OperationContext,
    incoming_request: IncomingHttpRequest,
) -> Result<CatchAnswer, OperationError> {
    let http_bin =
        find_or_create_bin(operation_context, &read_bin_name(&incoming_request.path)).await?;
    let answer: HttpMockResponse = serde_json::from_str(&http_bin.default_response_json)
        .unwrap_or_else(|_| plain_default_response());
    let files = read_uploaded_files(&incoming_request);
    let captured_request = CapturedRequestRecord {
        request_id: operation_context.id_generator.generate_id().to_string(),
        bin_id: http_bin.bin_id.clone(),
        bin_name: http_bin.name.clone(),
        method: incoming_request.method.to_ascii_uppercase(),
        query_json: write_json(&read_query(incoming_request.query_string.as_deref())),
        headers_json: write_json(&incoming_request.headers),
        content_type: incoming_request.headers.get("content-type").cloned(),
        body: String::from_utf8_lossy(&incoming_request.body).into_owned(),
        url: incoming_request.url,
        path: incoming_request.path,
        client_ip: incoming_request.client_ip,
        response_status: answer.status_code,
        response_headers_json: write_json(&answer.headers),
        response_body: answer.body.clone(),
        matched_rule_id: None,
        matched_rule_name: None,
        is_simulated_failure: false,
        duration_ms: 1,
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
        files,
    };
    let request_id = captured_request.request_id.clone();
    operation_context
        .http_catcher_stores
        .requests
        .insert_request(captured_request)
        .await?;
    publish_event(
        operation_context,
        AppEventType::HttpCaptured,
        json!({ "id": request_id, "bin_name": http_bin.name }),
    );
    Ok(CatchAnswer {
        request_id,
        response: answer,
    })
}
