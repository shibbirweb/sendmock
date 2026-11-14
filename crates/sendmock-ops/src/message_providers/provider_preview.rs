use std::collections::BTreeMap;

use sendmock_core::{StandardTemplateFunctions, TemplateEscape, format_rfc3339, render_template};
use sendmock_sms::count_segments;
use serde_json::{Value, json};

use super::credential_masking::{mask_secret_credentials, merge_credentials};
use super::preview_response::{collect_problems, render_preview_response};
use super::provider_inputs::{ProviderPreviewRequest, ProviderSampleRequest};
use super::provider_views::{MessageProviderPreview, PreviewStoredMessage};
use super::sample_request_builder::build_sample_request;
use super::template_reference::build_provider_template_reference;
use crate::OperationContext;
use crate::providers::{
    MessageProviderDefinition, ProviderCall, ProviderFailure, ProviderHttpRequest,
    ProviderOperation, ProviderRoute, find_rule_failure, has_valid_credentials, match_operation,
    read_request_fields,
};

/// The stand-in for SendMock's own id, since the preview stores nothing.
const PREVIEW_MESSAGE_ID: &str = "01JB7T9Q2RPREVIEW000000000";

/// The provider the preview runs: the unsaved settings with the stored secrets behind masked
/// values, on whether or not the provider is.
fn prepare_preview_provider(
    stored_provider: &MessageProviderDefinition,
    preview_request: &ProviderPreviewRequest,
) -> MessageProviderDefinition {
    let mut provider = preview_request.provider.clone().apply_to(stored_provider);
    provider.credentials = merge_credentials(&stored_provider.credentials, provider.credentials);
    provider.is_enabled = true;
    provider.is_removed = false;
    provider
}

/// The operation the sample matches (an empty one when none does) and its path values.
fn match_sample(
    provider: &MessageProviderDefinition,
    http_request: &ProviderHttpRequest,
) -> (ProviderOperation, BTreeMap<String, String>) {
    let routed_providers = [provider.clone()];
    match_operation(
        &routed_providers,
        ProviderRoute::Prefixed(&provider.key),
        http_request,
    )
    .map_or_else(Default::default, |matched| {
        (matched.operation.clone(), matched.path_params)
    })
}

/// Why the runtime would refuse the sample, checked in the runtime's order.
fn find_preview_failure(
    provider: &MessageProviderDefinition,
    operation: &ProviderOperation,
    http_request: &ProviderHttpRequest,
    has_readable_body: bool,
    part_values: &BTreeMap<String, Vec<String>>,
) -> Option<ProviderFailure> {
    let refuse = |kind: &str, part: &str, reason: &str| {
        Some(ProviderFailure::new(kind, part, reason.to_owned()))
    };
    if operation.kind.is_empty() {
        return refuse(
            "not_found",
            "path",
            "No request matches this method and path",
        );
    }
    if !has_readable_body {
        return refuse("invalid_value", "body", "The body is not valid JSON");
    }
    if !has_valid_credentials(provider, http_request) {
        return refuse(
            "unauthorized",
            "credentials",
            "The credentials do not match",
        );
    }
    find_rule_failure(provider, part_values)
}

/// Runs a sample request through unsaved provider settings: the message SendMock would store
/// and the answer it would give, with each template problem named by its part. Secrets are
/// checked with their stored values and shown masked.
pub fn preview_provider(
    operation_context: &OperationContext,
    stored_provider: &MessageProviderDefinition,
    preview_request: ProviderPreviewRequest,
) -> MessageProviderPreview {
    let provider = prepare_preview_provider(stored_provider, &preview_request);
    let sample_request = preview_request
        .sample_request
        .unwrap_or_else(|| build_sample_request(&provider));
    let http_request = to_http_request(&sample_request);
    let (operation, path_params) = match_sample(&provider, &http_request);
    let request_format = if operation.kind.is_empty() {
        "json"
    } else {
        operation.request_format.as_str()
    };
    let request_fields = read_request_fields(&http_request, request_format);
    let masked_provider = MessageProviderDefinition {
        credentials: mask_secret_credentials(&provider.credentials),
        ..provider.clone()
    };
    let template_functions = StandardTemplateFunctions::new(
        operation_context.clock.clone(),
        operation_context.random_source.clone(),
    );
    let provider_call = ProviderCall {
        provider: &masked_provider,
        operation: &operation,
        path_params,
        request: &http_request,
        request_fields: request_fields.clone().unwrap_or_default(),
        template_functions: &template_functions,
    };
    let part_values = provider_call.read_part_values();
    let failure = find_preview_failure(
        &provider,
        &operation,
        &http_request,
        request_fields.is_some(),
        &part_values,
    );
    let created_at = format_rfc3339(operation_context.clock.now_unix_ms());
    run_preview(&provider_call, &part_values, failure.as_ref(), &created_at)
}

/// The message id, the answer, the stored message and the reference for a checked sample.
fn run_preview(
    provider_call: &ProviderCall<'_>,
    part_values: &BTreeMap<String, Vec<String>>,
    failure: Option<&ProviderFailure>,
    created_at: &str,
) -> MessageProviderPreview {
    let provider = provider_call.provider;
    let read_part = |part: &str| {
        part_values
            .get(part)
            .map(|values| values.join(", "))
            .unwrap_or_default()
    };
    let body_part = if provider.area == "email" {
        "text"
    } else {
        "body"
    };
    let mut message = describe_preview_message(provider, part_values, created_at);
    let mut problems = Vec::new();
    let provider_id = render_template(
        &provider.message_id_template,
        &provider_call.build_template_context(&message, failure),
        provider_call.template_functions,
        TemplateEscape::None,
    );
    collect_problems(&mut problems, "Message id", provider_id.problems);
    message["provider_id"] = Value::from(provider_id.text.clone());
    let response = render_preview_response(provider_call, &message, failure, &mut problems);
    let operation_kind = &provider_call.operation.kind;
    MessageProviderPreview {
        operation_kind: (!operation_kind.is_empty()).then(|| operation_kind.clone()),
        stored_message: failure.is_none().then(|| PreviewStoredMessage {
            from: read_part("from"),
            to: part_values.get("to").cloned().unwrap_or_default(),
            subject: (provider.area == "email").then(|| read_part("subject")),
            body: read_part(body_part),
            metadata: BTreeMap::from([("provider_id".to_owned(), provider_id.text)]),
        }),
        response,
        problems,
        reference: build_provider_template_reference(
            &provider_call.build_template_context(&message, failure),
        ),
    }
}

/// The message as templates read it, with the fields the runtime gives a stored SMS, so a
/// template that works for real sends shows no warnings here.
fn describe_preview_message(
    provider: &MessageProviderDefinition,
    part_values: &BTreeMap<String, Vec<String>>,
    created_at: &str,
) -> Value {
    let read_part = |part: &str| {
        part_values
            .get(part)
            .map(|values| values.join(", "))
            .unwrap_or_default()
    };
    let body = read_part(if provider.area == "email" {
        "text"
    } else {
        "body"
    });
    let media_count = part_values.get("media_urls").map_or(0, Vec::len);
    let messaging_service_sid = part_values
        .get("messaging_service")
        .and_then(|values| values.first().cloned());
    json!({
        "id": PREVIEW_MESSAGE_ID,
        "provider_id": "",
        "from": read_part("from"),
        "to": read_part("to"),
        "subject": read_part("subject"),
        "body": body,
        "status": provider.status_name("queued"),
        "segments": count_segments(&body).segments.to_string(),
        "num_media": media_count.to_string(),
        "error_code": Value::Null,
        "messaging_service_sid": messaging_service_sid,
        "created_at": created_at,
        "updated_at": created_at,
    })
}

/// The sample as the runtime reads a request: the query split off the path, header names in
/// lowercase.
fn to_http_request(sample_request: &ProviderSampleRequest) -> ProviderHttpRequest {
    let (path, query_string) = match sample_request.path.split_once('?') {
        Some((path, query_string)) => (path.to_owned(), Some(query_string.to_owned())),
        None => (sample_request.path.clone(), None),
    };
    ProviderHttpRequest {
        method: sample_request.method.to_ascii_uppercase(),
        path,
        query_string,
        headers: sample_request
            .headers
            .iter()
            .map(|(header_name, header_value)| {
                (header_name.to_ascii_lowercase(), header_value.clone())
            })
            .collect(),
        body: sample_request.body.clone().into_bytes(),
    }
}
