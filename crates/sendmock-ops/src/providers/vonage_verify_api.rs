//! Vonage Verify v2 (`api.nexmo.com/v2/verify`), as the Vonage Node SDK's `Verify2` calls it
//! (VF-05). Like Twilio Verify, a stateful API stays in code over the verify domain, so a Vonage
//! verification is an ordinary SendMock verification, under a service named after its brand.

use serde_json::{Value, json};

use super::message_provider_definition::MessageProviderDefinition;
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::provider_runtime::ProviderOutcome;
use super::request_checks::has_valid_credentials;
use super::request_reader::read_request_fields;
use super::twilio_answers::answer_json;
use crate::verify::{
    VerificationStart, VerifyRefusal, check_verification, expire_overdue_verifications,
    finish_verification, new_verify_service, start_verification,
};
use crate::{OperationContext, OperationError, ProviderRoute};

pub const VONAGE_VERIFY_PROVIDER_KEY: &str = "vonage_verify";
const VERIFY_PATH: &str = "/v2/verify";
const PROBLEM_TYPE_BASE: &str = "https://developer.vonage.com/api-errors";
/// Vonage's codes are 4 digits unless the request asks for 4 to 10.
const DEFAULT_CODE_LENGTH: u32 = 4;

/// Vonage's error answer: problem details with a type URL and an instance id.
fn answer_problem(
    operation_context: &OperationContext,
    status: u16,
    (title, type_fragment): (&str, &str),
    detail: &str,
) -> ProviderHttpResponse {
    answer_json(
        status,
        json!({
            "title": title,
            "type": format!("{PROBLEM_TYPE_BASE}#{type_fragment}"),
            "detail": detail,
            "instance": format!("{:016x}{:016x}", operation_context.random_source.next_u64(), operation_context.random_source.next_u64()),
        }),
    )
}

fn answer_not_found(
    operation_context: &OperationContext,
    request_id: &str,
) -> ProviderHttpResponse {
    answer_problem(
        operation_context,
        404,
        ("Not Found", "not-found"),
        &format!("Request {request_id} was not found or it has been verified already."),
    )
}

/// Vonage Verify's API, served with the `vonage_verify` provider while it is routable.
pub async fn answer_vonage_verify(
    operation_context: &OperationContext,
    providers: &[MessageProviderDefinition],
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    let is_verify_route = matches!(
        provider_route,
        ProviderRoute::Prefixed(VONAGE_VERIFY_PROVIDER_KEY) | ProviderRoute::ProviderPort
    );
    let Some(verify_provider) = providers
        .iter()
        .find(|provider| provider.key == VONAGE_VERIFY_PROVIDER_KEY && provider.is_routable())
        .filter(|_| is_verify_route)
    else {
        return Ok(None);
    };
    let Some(rest_of_path) = request.path.strip_prefix(VERIFY_PATH) else {
        return Ok(None);
    };
    let request_id = rest_of_path.trim_matches('/');
    let response = if !has_valid_credentials(verify_provider, request) {
        answer_problem(
            operation_context,
            401,
            ("Unauthorized", "unauthorized"),
            "You did not provide correct credentials.",
        )
    } else {
        match (request.method.as_str(), request_id) {
            ("POST", "") => answer_start(operation_context, request).await?,
            ("POST", request_id) if !request_id.contains('/') => {
                answer_check(operation_context, request, request_id).await?
            }
            ("DELETE", request_id) if !request_id.is_empty() && !request_id.contains('/') => {
                answer_cancel(operation_context, request_id).await?
            }
            _ => return Ok(None),
        }
    };
    Ok(Some(ProviderOutcome {
        response,
        provider_key: Some(VONAGE_VERIFY_PROVIDER_KEY.to_owned()),
        created_message: None,
        secret_values: verify_provider
            .credentials
            .iter()
            .filter(|credential| credential.is_secret)
            .map(|credential| credential.value.clone())
            .collect(),
    }))
}

/// Vonage's workflow channels in SendMock's words; silent authentication is not emulated.
fn read_channel(vonage_channel: &str) -> Option<&'static str> {
    match vonage_channel {
        "sms" => Some("sms"),
        "whatsapp" => Some("whatsapp"),
        "email" => Some("email"),
        "voice" => Some("call"),
        _ => None,
    }
}

/// The brand's service, made on first use with the request's code length.
async fn find_brand_service(
    operation_context: &OperationContext,
    brand: &str,
    code_length: u32,
) -> Result<sendmock_store::VerifyServiceRecord, OperationError> {
    let services = operation_context
        .verify_service_repository
        .list_services()
        .await?;
    if let Some(brand_service) = services
        .into_iter()
        .find(|service| service.friendly_name == brand)
    {
        return Ok(brand_service);
    }
    let brand_service = sendmock_store::VerifyServiceRecord {
        friendly_name: brand.to_owned(),
        code_length,
        ..new_verify_service(operation_context).await?
    };
    operation_context
        .verify_service_repository
        .save_service(brand_service.clone())
        .await?;
    Ok(brand_service)
}

fn invalid_params(operation_context: &OperationContext, detail: &str) -> ProviderHttpResponse {
    answer_problem(
        operation_context,
        422,
        ("Invalid params", "invalid-params"),
        detail,
    )
}

/// The requested code length when it is one Vonage allows (4 to 10), else the default.
fn read_code_length(fields: &Value) -> u32 {
    fields["code_length"]
        .as_u64()
        .and_then(|code_length| u32::try_from(code_length).ok())
        .filter(|code_length| (4..=10).contains(code_length))
        .unwrap_or(DEFAULT_CODE_LENGTH)
}

/// Vonage writes phone numbers without the `+`; SendMock stores them in E.164.
fn read_to_address(channel: &str, recipient: &str) -> String {
    if channel != "email" && !recipient.starts_with('+') {
        format!("+{recipient}")
    } else {
        recipient.to_owned()
    }
}

/// `POST /v2/verify`: the first workflow step's channel and recipient start a verification.
async fn answer_start(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
) -> Result<ProviderHttpResponse, OperationError> {
    let fields = read_request_fields(request, "json").unwrap_or(Value::Null);
    let brand = fields["brand"].as_str().unwrap_or_default().trim();
    let first_step = &fields["workflow"][0];
    let (Some(vonage_channel), Some(recipient)) =
        (first_step["channel"].as_str(), first_step["to"].as_str())
    else {
        return Ok(invalid_params(
            operation_context,
            "The value of one or more parameters is invalid: brand and workflow[0] with channel and to are required",
        ));
    };
    let Some(channel) = read_channel(vonage_channel).filter(|_| !brand.is_empty()) else {
        return Ok(invalid_params(
            operation_context,
            &format!(
                "The value of one or more parameters is invalid: channel {vonage_channel} is not supported"
            ),
        ));
    };
    let to_address = read_to_address(channel, recipient);
    let brand_service =
        find_brand_service(operation_context, brand, read_code_length(&fields)).await?;
    let verification_start = VerificationStart {
        verify_service: &brand_service,
        to_address: &to_address,
        channel,
        account_sid: None,
    };
    Ok(
        match start_verification(operation_context, verification_start).await? {
            Ok(verification) => {
                answer_json(202, json!({ "request_id": verification.verification_sid }))
            }
            Err(_) => answer_problem(
                operation_context,
                409,
                ("Conflict", "conflict"),
                "Concurrent verifications to the same number are not allowed.",
            ),
        },
    )
}

/// `POST /v2/verify/{request_id}` with the `code`.
async fn answer_check(
    operation_context: &OperationContext,
    request: &ProviderHttpRequest,
    request_id: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    let fields = read_request_fields(request, "json").unwrap_or(Value::Null);
    let Some(given_code) = fields["code"].as_str() else {
        return Ok(invalid_params(
            operation_context,
            "The value of one or more parameters is invalid: code is required",
        ));
    };
    expire_overdue_verifications(operation_context).await?;
    let pending_verification = operation_context
        .verification_repository
        .find_verification(request_id)
        .await?
        .filter(|verification| verification.status == "pending");
    let Some(verification) = pending_verification else {
        return Ok(answer_not_found(operation_context, request_id));
    };
    Ok(
        match check_verification(operation_context, verification, given_code).await? {
            Ok(checked) if checked.status == "approved" => answer_json(
                200,
                json!({ "request_id": request_id, "status": "completed" }),
            ),
            Ok(_) => answer_problem(
                operation_context,
                400,
                ("Invalid Code", "invalid-code"),
                "The code you provided does not match the expected value.",
            ),
            Err(
                VerifyRefusal::MaxCheckAttempts
                | VerifyRefusal::NotFound
                | VerifyRefusal::MaxSendAttempts,
            ) => answer_not_found(operation_context, request_id),
        },
    )
}

/// `DELETE /v2/verify/{request_id}`: the pending verification is cancelled.
async fn answer_cancel(
    operation_context: &OperationContext,
    request_id: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    expire_overdue_verifications(operation_context).await?;
    let pending_verification = operation_context
        .verification_repository
        .find_verification(request_id)
        .await?
        .filter(|verification| verification.status == "pending");
    let Some(verification) = pending_verification else {
        return Ok(answer_not_found(operation_context, request_id));
    };
    finish_verification(
        operation_context,
        verification,
        "canceled",
        "Cancelled by your app",
    )
    .await?;
    Ok(ProviderHttpResponse {
        status: 204,
        headers: Vec::new(),
        body: String::new(),
    })
}
