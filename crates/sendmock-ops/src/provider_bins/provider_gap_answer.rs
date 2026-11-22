//! A provider request no built-in operation answers, captured in the provider's attached bin
//! and answered by the bin's rules (PL-21.2).

use std::collections::BTreeMap;

use sendmock_store::CatcherAnswerRecord;

use super::provider_gap_resolution::find_gap_bin;
use crate::http_catcher::capture_in_bin;
use crate::providers::{ProviderHttpRequest, ProviderOutcome};
use crate::{HttpMockResponse, IncomingHttpRequest, OperationContext, OperationError};

/// Where the request came from, as the transport saw it.
#[derive(Debug, Clone)]
pub struct ProviderGapOrigin {
    /// The full URL the client called.
    pub url: String,
    pub client_ip: String,
}

/// The bin's answer to a provider request, with what the request log names.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderGapAnswer {
    pub provider_key: String,
    pub response: HttpMockResponse,
    /// The rule's delay, which the transport waits before answering.
    pub delay_ms: u32,
    pub catcher_answer: CatcherAnswerRecord,
}

/// The request as the catcher stores it, at the provider's own path.
fn to_incoming_request(
    request: &ProviderHttpRequest,
    origin: ProviderGapOrigin,
) -> IncomingHttpRequest {
    IncomingHttpRequest {
        method: request.method.clone(),
        url: origin.url,
        path: request.path.clone(),
        query_string: request.query_string.clone(),
        headers: request
            .headers
            .iter()
            .map(|(header_name, header_value)| {
                (header_name.to_ascii_lowercase(), header_value.clone())
            })
            .collect::<BTreeMap<_, _>>(),
        body: request.body.clone(),
        client_ip: origin.client_ip,
    }
}

/// The attached bin's answer when the built-in answer was the provider's "no such path" and a
/// bin serves the provider; `None` keeps the built-in answer.
pub async fn answer_provider_gap(
    operation_context: &OperationContext,
    builtin_outcome: &ProviderOutcome,
    request: &ProviderHttpRequest,
    origin: ProviderGapOrigin,
) -> Result<Option<ProviderGapAnswer>, OperationError> {
    if !builtin_outcome.is_unknown_path {
        return Ok(None);
    }
    let Some(provider_bin) = find_gap_bin(
        operation_context,
        builtin_outcome.provider_key.as_deref(),
        request,
    )
    .await?
    else {
        return Ok(None);
    };
    let Some(http_bin) = operation_context
        .http_catcher_stores
        .bins
        .find_bin(&provider_bin.bin_id)
        .await?
    else {
        return Ok(None);
    };
    let catch_answer = capture_in_bin(
        operation_context,
        &http_bin,
        to_incoming_request(request, origin),
        Some(provider_bin.provider_key.clone()),
    )
    .await?;
    Ok(Some(ProviderGapAnswer {
        provider_key: provider_bin.provider_key,
        response: catch_answer.response,
        delay_ms: catch_answer.delay_ms,
        catcher_answer: CatcherAnswerRecord {
            bin_name: catch_answer.bin_name,
            rule_name: catch_answer.matched_rule_name,
        },
    }))
}
