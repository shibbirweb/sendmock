use super::message_provider_definition::MessageProviderDefinition;
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::request_reader::read_request_fields;
use super::twilio_answers::{answer_twilio_error, read_account_sid};
use super::twilio_verify_services::{answer_verify_not_found, answer_verify_service_request};
use super::twilio_verify_verifications::{
    VerifyCall, answer_check, answer_start, answer_verification,
};
use crate::providers::request_checks::has_valid_credentials;
use crate::{OperationContext, OperationError};

const VERIFY_SERVICES_PATH: &str = "/v2/Services";

/// Twilio Verify's API (`verify.twilio.com/v2/Services`), whose state machine stays in code
/// (docs/plan/22-configurable-providers.md). `None` for other paths.
pub async fn answer_twilio_verify_request(
    operation_context: &OperationContext,
    verify_provider: &MessageProviderDefinition,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderHttpResponse>, OperationError> {
    let Some(rest_of_path) = request.path.strip_prefix(VERIFY_SERVICES_PATH) else {
        return Ok(None);
    };
    let path_segments: Vec<&str> = rest_of_path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    if !has_valid_credentials(verify_provider, request) {
        return Ok(Some(answer_twilio_error(401, 20003, "Authenticate")));
    }
    let fields = read_request_fields(request, "form").unwrap_or_default();
    let account_sid = read_account_sid(verify_provider, request);
    let method = request.method.as_str();
    let Some((&service_sid, verification_path)) = path_segments.split_first() else {
        return answer_verify_service_request(
            operation_context,
            method,
            None,
            &fields,
            &account_sid,
        )
        .await;
    };
    if verification_path.is_empty() {
        return answer_verify_service_request(
            operation_context,
            method,
            Some(service_sid),
            &fields,
            &account_sid,
        )
        .await;
    }
    let Some(verify_service) = operation_context
        .verify_service_repository
        .find_service(service_sid)
        .await?
    else {
        return Ok(Some(answer_verify_not_found(&format!(
            "/Services/{service_sid}"
        ))));
    };
    let verify_call = VerifyCall {
        verify_service: &verify_service,
        fields: &fields,
        account_sid: &account_sid,
    };
    answer_verification_path(operation_context, &verify_call, method, verification_path).await
}

/// `Verifications`, `Verifications/{Sid}` and `VerificationCheck` under a service.
async fn answer_verification_path(
    operation_context: &OperationContext,
    verify_call: &VerifyCall<'_>,
    method: &str,
    verification_path: &[&str],
) -> Result<Option<ProviderHttpResponse>, OperationError> {
    let response = match (method, verification_path) {
        ("POST", ["Verifications"]) => answer_start(operation_context, verify_call).await?,
        ("GET" | "POST", ["Verifications", verification_sid]) => {
            answer_verification(operation_context, verify_call, method, verification_sid).await?
        }
        ("POST", ["VerificationCheck"]) => answer_check(operation_context, verify_call).await?,
        _ => return Ok(None),
    };
    Ok(Some(response))
}
