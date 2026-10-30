use sendmock_core::StandardTemplateFunctions;

use super::message_provider_definition::MessageProviderDefinition;
use super::operation_matcher::{ProviderRoute, match_operation};
use super::provider_call::ProviderCall;
use super::provider_catalog::{SMS_PROVIDER_AREA, load_area_providers};
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::read_operation_kinds::{answer_fetch, answer_list};
use super::request_checks::{ProviderFailure, has_valid_credentials};
use super::request_reader::read_request_fields;
use super::send_operation_kind::{ProviderAnswer, answer_send};
use super::twilio_messaging_services::answer_messaging_services_request;
use super::twilio_verify_api::answer_twilio_verify_request;
use crate::{OperationContext, OperationError};

/// Messaging Services are Twilio's; their API is served under its key.
const TWILIO_PROVIDER_KEY: &str = "twilio";
/// Twilio Verify's API is served under its own key.
const TWILIO_VERIFY_PROVIDER_KEY: &str = "twilio_verify";

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

/// The SMS providers as they are now, so a saved change applies to the next request.
pub async fn load_sms_provider_definitions(
    operation_context: &OperationContext,
) -> Result<Vec<MessageProviderDefinition>, OperationError> {
    load_area_providers(operation_context, SMS_PROVIDER_AREA).await
}

/// Answers a request at a provider path from the provider's current definition: the matching
/// operation, the credential check, then the operation kind. Paths no provider answers get
/// SendMock's native `404`.
pub async fn answer_provider_request(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<ProviderOutcome, OperationError> {
    let providers = load_sms_provider_definitions(operation_context).await?;
    if let Some(code_served_outcome) =
        answer_code_served_api(operation_context, &providers, provider_route, request).await?
    {
        return Ok(code_served_outcome);
    }
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

/// The APIs served in code beside the definitions: Twilio's Messaging Services and Verify.
async fn answer_code_served_api(
    operation_context: &OperationContext,
    providers: &[MessageProviderDefinition],
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    if let Some(services_outcome) =
        answer_twilio_services(operation_context, providers, provider_route, request).await?
    {
        return Ok(Some(services_outcome));
    }
    answer_twilio_verify(operation_context, providers, provider_route, request).await
}

/// Twilio's Messaging Services API, served with the Twilio provider while it is routable.
async fn answer_twilio_services(
    operation_context: &OperationContext,
    providers: &[MessageProviderDefinition],
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    let is_twilio_route = matches!(
        provider_route,
        ProviderRoute::Prefixed(TWILIO_PROVIDER_KEY) | ProviderRoute::ProviderPort
    );
    let Some(twilio_provider) = providers
        .iter()
        .find(|provider| provider.key == TWILIO_PROVIDER_KEY && provider.is_routable())
        .filter(|_| is_twilio_route)
    else {
        return Ok(None);
    };
    let services_response =
        answer_messaging_services_request(operation_context, twilio_provider, request).await?;
    Ok(services_response.map(|response| ProviderOutcome {
        response,
        provider_key: Some(TWILIO_PROVIDER_KEY.to_owned()),
        created_sms_id: None,
        secret_values: list_secret_values(twilio_provider),
    }))
}

/// Twilio Verify's API, served with the Twilio Verify provider while it is routable.
async fn answer_twilio_verify(
    operation_context: &OperationContext,
    providers: &[MessageProviderDefinition],
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    let is_verify_route = matches!(
        provider_route,
        ProviderRoute::Prefixed(TWILIO_VERIFY_PROVIDER_KEY) | ProviderRoute::ProviderPort
    );
    let Some(verify_provider) = providers
        .iter()
        .find(|provider| provider.key == TWILIO_VERIFY_PROVIDER_KEY && provider.is_routable())
        .filter(|_| is_verify_route)
    else {
        return Ok(None);
    };
    let verify_response =
        answer_twilio_verify_request(operation_context, verify_provider, request).await?;
    Ok(verify_response.map(|response| ProviderOutcome {
        response,
        provider_key: Some(TWILIO_VERIFY_PROVIDER_KEY.to_owned()),
        created_sms_id: None,
        secret_values: list_secret_values(verify_provider),
    }))
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
