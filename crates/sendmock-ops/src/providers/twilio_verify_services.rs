use sendmock_core::format_rfc3339;
use sendmock_store::VerifyServiceRecord;
use serde_json::{Value, json};

use super::provider_http::ProviderHttpResponse;
use super::twilio_answers::{
    answer_json, answer_no_content, answer_twilio_error, describe_page_meta, read_form_field,
};
use crate::verify::new_verify_service;
use crate::{OperationContext, OperationError};

pub const VERIFY_SERVICES_URL: &str = "https://verify.twilio.com/v2/Services";
const CODE_LENGTH_RANGE: std::ops::RangeInclusive<u32> = 4..=10;

/// `/v2/Services` and `/v2/Services/{ServiceSid}`: create, list, fetch, update and delete.
pub async fn answer_verify_service_request(
    operation_context: &OperationContext,
    method: &str,
    service_sid: Option<&str>,
    fields: &Value,
    account_sid: &str,
) -> Result<Option<ProviderHttpResponse>, OperationError> {
    let repository = &operation_context.verify_service_repository;
    let response = match (method, service_sid) {
        ("POST", None) => {
            if read_form_field(fields, "FriendlyName").is_none() {
                return Ok(Some(answer_twilio_error(
                    400,
                    20001,
                    "Missing required parameter FriendlyName in the post body",
                )));
            }
            save_service(
                operation_context,
                new_verify_service(operation_context),
                fields,
                account_sid,
                201,
            )
            .await?
        }
        ("GET", None) => answer_service_page(operation_context, account_sid).await?,
        ("GET", Some(service_sid)) => match repository.find_service(service_sid).await? {
            Some(service) => answer_json(200, describe_verify_service(&service, account_sid)),
            None => answer_verify_not_found(&format!("/Services/{service_sid}")),
        },
        ("POST", Some(service_sid)) => match repository.find_service(service_sid).await? {
            Some(service) => {
                save_service(operation_context, service, fields, account_sid, 200).await?
            }
            None => answer_verify_not_found(&format!("/Services/{service_sid}")),
        },
        ("DELETE", Some(service_sid)) => {
            if repository.delete_service(service_sid).await? {
                answer_no_content()
            } else {
                answer_verify_not_found(&format!("/Services/{service_sid}"))
            }
        }
        _ => return Ok(None),
    };
    Ok(Some(response))
}

async fn answer_service_page(
    operation_context: &OperationContext,
    account_sid: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    let services: Vec<Value> = operation_context
        .verify_service_repository
        .list_services()
        .await?
        .iter()
        .map(|service| describe_verify_service(service, account_sid))
        .collect();
    Ok(answer_json(
        200,
        json!({ "services": services, "meta": describe_page_meta(VERIFY_SERVICES_URL, "services") }),
    ))
}

/// `FriendlyName` and `CodeLength` (4 to 10, else Twilio's `60200`).
async fn save_service(
    operation_context: &OperationContext,
    mut service: VerifyServiceRecord,
    fields: &Value,
    account_sid: &str,
    success_status: u16,
) -> Result<ProviderHttpResponse, OperationError> {
    if let Some(friendly_name) = read_form_field(fields, "FriendlyName") {
        service.friendly_name = friendly_name;
    }
    if let Some(code_length_text) = read_form_field(fields, "CodeLength") {
        match code_length_text.parse::<u32>() {
            Ok(code_length) if CODE_LENGTH_RANGE.contains(&code_length) => {
                service.code_length = code_length;
                service.fixed_code = service
                    .fixed_code
                    .filter(|fixed_code| fixed_code.len() == code_length as usize);
            }
            _ => {
                return Ok(answer_twilio_error(
                    400,
                    60200,
                    "Invalid parameter: CodeLength",
                ));
            }
        }
    }
    operation_context
        .verify_service_repository
        .save_service(service.clone())
        .await?;
    Ok(answer_json(
        success_status,
        describe_verify_service(&service, account_sid),
    ))
}

/// A Verify service as Twilio's API answers it.
fn describe_verify_service(service: &VerifyServiceRecord, account_sid: &str) -> Value {
    let service_url = format!("{VERIFY_SERVICES_URL}/{}", service.service_sid);
    let created_at = format_rfc3339(service.created_at_unix_ms);
    json!({
        "sid": service.service_sid,
        "account_sid": account_sid,
        "friendly_name": service.friendly_name,
        "code_length": service.code_length,
        "lookup_enabled": false,
        "psd2_enabled": false,
        "skip_sms_to_landlines": false,
        "dtmf_input_required": false,
        "tts_name": Value::Null,
        "do_not_share_warning_enabled": false,
        "custom_code_enabled": true,
        "default_template_sid": Value::Null,
        "date_created": created_at,
        "date_updated": created_at,
        "url": service_url,
        "links": {
            "verifications": format!("{service_url}/Verifications"),
            "verification_checks": format!("{service_url}/VerificationCheck"),
        },
    })
}

pub fn answer_verify_not_found(resource_path: &str) -> ProviderHttpResponse {
    answer_twilio_error(
        404,
        20404,
        &format!("The requested resource {resource_path} was not found"),
    )
}
