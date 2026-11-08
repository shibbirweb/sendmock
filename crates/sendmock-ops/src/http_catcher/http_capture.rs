//! Records a request to `/catch/<bin>/...` and answers it as the bin says (HC-01.1).

use std::collections::BTreeMap;

use sendmock_store::{CapturedFileRecord, CapturedRequestRecord, HttpBinRecord};
use serde_json::json;

use super::http_bin_presets::plain_default_response;
use super::http_catcher_views::present_captured_request;
use super::http_catcher_wire::{CapturedHttpRequest, HttpMockResponse};
use super::http_response_rules::{
    HttpResponseRule, build_response_context, find_answering_rule, render_mock_response,
};
use super::http_rule_operations::read_bin_rules;
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
    /// The matching rule's delay, which the route waits before answering.
    pub delay_ms: u32,
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

/// A reply decided for one request: the rule that gave it, whether the failure rate struck, and
/// how long to wait before answering.
struct DecidedAnswer {
    response: HttpMockResponse,
    rule: Option<HttpResponseRule>,
    is_simulated_failure: bool,
    delay_ms: u32,
}

/// The first matching rule's reply (or the bin's default), with the failure rate and delay
/// drawn from the random source (HC-02.1 to HC-02.3).
async fn decide_answer(
    operation_context: &OperationContext,
    http_bin: &HttpBinRecord,
    request_view: &CapturedHttpRequest,
) -> Result<DecidedAnswer, OperationError> {
    let rules = read_bin_rules(&http_bin.rules_json);
    let answering_rule = find_answering_rule(&rules, request_view).cloned();
    let random_source = &operation_context.random_source;
    let is_simulated_failure = answering_rule
        .as_ref()
        .is_some_and(|rule| random_source.next_u64() % 100 < u64::from(rule.failure_rate_percent));
    let mock_response = match (&answering_rule, is_simulated_failure) {
        (Some(rule), true) => HttpMockResponse {
            status_code: rule.failure_status_code,
            headers: [("content-type".to_owned(), "application/json".to_owned())].into(),
            body: r#"{"error":"Simulated failure"}"#.to_owned(),
        },
        (Some(rule), false) => rule.response.clone(),
        (None, _) => serde_json::from_str(&http_bin.default_response_json)
            .unwrap_or_else(|_| plain_default_response()),
    };
    let response_context = build_response_context(operation_context, request_view).await?;
    let (response, _) = render_mock_response(operation_context, &mock_response, &response_context);
    let delay_ms = answering_rule.as_ref().map_or(0, |rule| {
        let delay_spread = u64::from(rule.delay_max_ms - rule.delay_min_ms) + 1;
        rule.delay_min_ms
            + u32::try_from(random_source.next_u64() % delay_spread).unwrap_or_default()
    });
    Ok(DecidedAnswer {
        response,
        rule: answering_rule,
        is_simulated_failure,
        delay_ms,
    })
}

/// Stores the request with the bin's answer and fires `http.captured`.
pub async fn capture_http_request(
    operation_context: &OperationContext,
    incoming_request: IncomingHttpRequest,
) -> Result<CatchAnswer, OperationError> {
    let http_bin =
        find_or_create_bin(operation_context, &read_bin_name(&incoming_request.path)).await?;
    let mut captured_request =
        build_captured_record(operation_context, &http_bin, incoming_request);
    let decided_answer = decide_answer(
        operation_context,
        &http_bin,
        &present_captured_request(captured_request.clone()),
    )
    .await?;
    captured_request.response_status = decided_answer.response.status_code;
    captured_request.response_headers_json = write_json(&decided_answer.response.headers);
    captured_request.response_body = decided_answer.response.body.clone();
    captured_request.matched_rule_id = decided_answer.rule.as_ref().map(|rule| rule.id.clone());
    captured_request.matched_rule_name = decided_answer.rule.as_ref().map(|rule| rule.name.clone());
    captured_request.is_simulated_failure = decided_answer.is_simulated_failure;
    captured_request.duration_ms = decided_answer.delay_ms + 1;
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
        response: decided_answer.response,
        delay_ms: decided_answer.delay_ms,
    })
}

/// The request as stored, before the reply is decided.
fn build_captured_record(
    operation_context: &OperationContext,
    http_bin: &HttpBinRecord,
    incoming_request: IncomingHttpRequest,
) -> CapturedRequestRecord {
    let files = read_uploaded_files(&incoming_request);
    CapturedRequestRecord {
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
        response_status: 200,
        response_headers_json: "{}".to_owned(),
        response_body: String::new(),
        matched_rule_id: None,
        matched_rule_name: None,
        is_simulated_failure: false,
        duration_ms: 1,
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
        files,
    }
}
