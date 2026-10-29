use sendmock_core::StandardTemplateFunctions;

use super::builtin_providers::builtin_sms_providers;
use super::message_provider_definition::MessageProviderDefinition;
use super::operation_matcher::{ProviderRoute, match_operation};
use super::provider_call::ProviderCall;
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::read_operation_kinds::{answer_fetch, answer_list};
use super::request_checks::{ProviderFailure, has_valid_credentials};
use super::request_reader::read_request_fields;
use super::send_operation_kind::{ProviderAnswer, answer_send};
use crate::{OperationContext, OperationError};

/// A provider request's answer, with what the request log needs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderOutcome {
    pub response: ProviderHttpResponse,
    /// `None` when no provider answers the path.
    pub provider_key: Option<String>,
    pub created_sms_id: Option<String>,
    /// Masked wherever they appear in the logged request.
    pub secret_values: Vec<String>,
}

/// The providers requests can reach now; Phase 2 serves the shipped SMS definitions.
pub fn load_sms_provider_definitions() -> Vec<MessageProviderDefinition> {
    builtin_sms_providers()
}

/// Answers a request at a provider path from the provider's current definition: the matching
/// operation, the credential check, then the operation kind. Paths no provider answers get
/// SendMock's native `404`.
pub async fn answer_provider_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<ProviderOutcome, OperationError> {
    let providers = load_sms_provider_definitions();
    let Some(matched_operation) = match_operation(&providers, provider_route, request) else {
        return Ok(answer_unmatched(provider_route));
    };
    let provider = matched_operation.provider;
    let template_functions = StandardTemplateFunctions::new(
        operation_context.clock.clone(),
        operation_context.random_source.clone(),
    );
    let request_fields = read_request_fields(request, &matched_operation.operation.request_format);
    let provider_call = ProviderCall {
        provider,
        operation: matched_operation.operation,
        path_params: matched_operation.path_params,
        request,
        request_fields: request_fields.clone().unwrap_or_default(),
        template_functions: &template_functions,
    };
    let provider_answer = if request_fields.is_none() {
        refuse(
            &provider_call,
            "invalid_value",
            "body",
            "The body is not valid JSON",
        )
    } else if !has_valid_credentials(provider, request) {
        refuse(
            &provider_call,
            "unauthorized",
            "credentials",
            "The credentials do not match",
        )
    } else {
        run_operation_kind(operation_context, &provider_call).await?
    };
    Ok(ProviderOutcome {
        response: provider_answer.response,
        provider_key: Some(provider.key.clone()),
        created_sms_id: provider_answer.created_sms_id,
        secret_values: list_secret_values(provider),
    })
}

/// SendMock's own `404`, logged under the prefix's provider when there is one.
fn answer_unmatched(provider_route: ProviderRoute<'_>) -> ProviderOutcome {
    ProviderOutcome {
        response: ProviderHttpResponse::native_not_found(
            "No provider answers this method and path",
        ),
        provider_key: match provider_route {
            ProviderRoute::Prefixed(provider_key) => Some(provider_key.to_owned()),
            ProviderRoute::ProviderPort => None,
        },
        created_sms_id: None,
        secret_values: Vec::new(),
    }
}

fn list_secret_values(provider: &MessageProviderDefinition) -> Vec<String> {
    provider
        .credentials
        .iter()
        .filter(|credential| credential.is_secret)
        .map(|credential| credential.value.clone())
        .collect()
}

fn refuse(
    provider_call: &ProviderCall<'_>,
    error_kind: &str,
    part: &str,
    reason: &str,
) -> ProviderAnswer {
    ProviderAnswer::without_message(provider_call.render_failure(&ProviderFailure::new(
        error_kind,
        part,
        reason.to_owned(),
    )))
}

/// Cancel answers the message as it is: SendMock never schedules messages, so none is still
/// waiting to be canceled.
async fn run_operation_kind(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
) -> Result<ProviderAnswer, OperationError> {
    match provider_call.operation.kind.as_str() {
        "send" => answer_send(operation_context, provider_call).await,
        "fetch" | "cancel" => answer_fetch(operation_context, provider_call).await,
        "list" => answer_list(operation_context, provider_call).await,
        other_kind => Ok(refuse(
            provider_call,
            "not_found",
            "path",
            &format!("The {other_kind} operation is not available in this version yet"),
        )),
    }
}
