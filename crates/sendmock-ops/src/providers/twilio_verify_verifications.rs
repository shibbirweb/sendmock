use sendmock_core::format_rfc3339;
use sendmock_store::{VerificationRecord, VerifyServiceRecord};
use serde_json::{Value, json};

use super::provider_http::ProviderHttpResponse;
use super::twilio_answers::{answer_json, answer_twilio_error, read_form_field};
use super::twilio_verify_services::{VERIFY_SERVICES_URL, answer_verify_not_found};
use crate::verify::{
    VerificationStart, VerifyRefusal, check_verification, expire_overdue_verifications,
    finish_verification, start_verification,
};
use crate::{OperationContext, OperationError};

const VERIFY_CHANNELS: [&str; 4] = ["sms", "whatsapp", "email", "call"];

/// The service and account a verification request is for.
pub struct VerifyCall<'call> {
    pub verify_service: &'call VerifyServiceRecord,
    pub fields: &'call Value,
    pub account_sid: &'call str,
}

/// `POST .../Verifications`: start, or resend to the recipient's pending verification.
pub async fn answer_start(
    operation_context: &OperationContext,
    verify_call: &VerifyCall<'_>,
) -> Result<ProviderHttpResponse, OperationError> {
    let Some(to_address) = read_form_field(verify_call.fields, "To") else {
        return Ok(answer_twilio_error(400, 60200, "Invalid parameter `To`: "));
    };
    let channel = read_form_field(verify_call.fields, "Channel").unwrap_or_default();
    if !VERIFY_CHANNELS.contains(&channel.as_str()) {
        return Ok(answer_twilio_error(
            400,
            60200,
            &format!("Invalid parameter `Channel`: {channel}"),
        ));
    }
    let verification_start = VerificationStart {
        verify_service: verify_call.verify_service,
        to_address: &to_address,
        channel: &channel,
        account_sid: Some(verify_call.account_sid.to_owned()),
    };
    Ok(
        match start_verification(operation_context, verification_start).await? {
            Ok(verification) => answer_json(
                201,
                describe_verification(&verification, verify_call.account_sid),
            ),
            Err(refusal) => answer_refusal(refusal, &to_address),
        },
    )
}

/// `GET` and `POST .../Verifications/{Sid}`: fetch, or set `Status` to `approved` or `canceled`.
pub async fn answer_verification(
    operation_context: &OperationContext,
    verify_call: &VerifyCall<'_>,
    method: &str,
    verification_sid: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    expire_overdue_verifications(operation_context).await?;
    let verification = operation_context
        .verification_repository
        .find_verification(verification_sid)
        .await?
        .filter(|verification| {
            verification.service_sid == verify_call.verify_service.service_sid
                && verification.status != "expired"
        });
    let Some(verification) = verification else {
        return Ok(answer_verify_not_found(&format!(
            "/Services/{}/Verifications/{verification_sid}",
            verify_call.verify_service.service_sid
        )));
    };
    if method != "POST" {
        return Ok(answer_json(
            200,
            describe_verification(&verification, verify_call.account_sid),
        ));
    }
    let final_status = match read_form_field(verify_call.fields, "Status").as_deref() {
        Some("approved") => "approved",
        Some("canceled") => "canceled",
        _ => return Ok(answer_twilio_error(400, 60200, "Invalid parameter: Status")),
    };
    let finished = finish_verification(
        operation_context,
        verification,
        final_status,
        "Set by your app",
    )
    .await?;
    Ok(answer_json(
        200,
        describe_verification(&finished, verify_call.account_sid),
    ))
}

/// `POST .../VerificationCheck` with `Code` and `To` or `VerificationSid`.
pub async fn answer_check(
    operation_context: &OperationContext,
    verify_call: &VerifyCall<'_>,
) -> Result<ProviderHttpResponse, OperationError> {
    let Some(given_code) = read_form_field(verify_call.fields, "Code") else {
        return Ok(answer_twilio_error(400, 60200, "Invalid parameter: Code"));
    };
    expire_overdue_verifications(operation_context).await?;
    let service_sid = &verify_call.verify_service.service_sid;
    let repository = &operation_context.verification_repository;
    let verification = match (
        read_form_field(verify_call.fields, "VerificationSid"),
        read_form_field(verify_call.fields, "To"),
    ) {
        (Some(verification_sid), _) => repository
            .find_verification(&verification_sid)
            .await?
            .filter(|verification| verification.service_sid == *service_sid),
        (None, Some(to_address)) => repository.find_pending(service_sid, &to_address).await?,
        (None, None) => {
            return Ok(answer_twilio_error(
                400,
                60200,
                "Invalid parameter: To or VerificationSid is required",
            ));
        }
    };
    let Some(verification) = verification else {
        return Ok(answer_verify_not_found(&format!(
            "/Services/{service_sid}/VerificationCheck"
        )));
    };
    let to_address = verification.to_address.clone();
    Ok(
        match check_verification(operation_context, verification, &given_code).await? {
            Ok(checked) => answer_json(200, describe_check(&checked, verify_call.account_sid)),
            Err(refusal) => answer_refusal(refusal, &to_address),
        },
    )
}

fn answer_refusal(refusal: VerifyRefusal, to_address: &str) -> ProviderHttpResponse {
    match refusal {
        VerifyRefusal::MaxSendAttempts => {
            answer_twilio_error(429, 60203, "Max send attempts reached")
        }
        VerifyRefusal::MaxCheckAttempts => {
            answer_twilio_error(429, 60202, "Max check attempts reached")
        }
        VerifyRefusal::NotFound => answer_verify_not_found(&format!("/Verifications/{to_address}")),
    }
}

/// A verification as Twilio's API answers it, with one send attempt per code sent.
fn describe_verification(verification: &VerificationRecord, account_sid: &str) -> Value {
    let send_code_attempts: Vec<Value> = (1..=verification.send_attempts)
        .map(|attempt_number| {
            json!({
                "attempt_sid": format!("VL{:032x}", u128::from(attempt_number)),
                "channel": verification.channel,
                "time": format_rfc3339(verification.updated_at_unix_ms),
            })
        })
        .collect();
    json!({
        "sid": verification.verification_sid,
        "service_sid": verification.service_sid,
        "account_sid": account_sid,
        "to": verification.to_address,
        "channel": verification.channel,
        "status": verification.status,
        "valid": verification.status == "approved",
        "lookup": {},
        "amount": Value::Null,
        "payee": Value::Null,
        "send_code_attempts": send_code_attempts,
        "date_created": format_rfc3339(verification.created_at_unix_ms),
        "date_updated": format_rfc3339(verification.updated_at_unix_ms),
        "sna": Value::Null,
        "url": format!("{VERIFY_SERVICES_URL}/{}/Verifications/{}", verification.service_sid, verification.verification_sid),
    })
}

/// A check as Twilio's API answers it: `approved` and valid, or still `pending`.
fn describe_check(verification: &VerificationRecord, account_sid: &str) -> Value {
    json!({
        "sid": verification.verification_sid,
        "service_sid": verification.service_sid,
        "account_sid": account_sid,
        "to": verification.to_address,
        "channel": verification.channel,
        "status": verification.status,
        "valid": verification.status == "approved",
        "amount": Value::Null,
        "payee": Value::Null,
        "date_created": format_rfc3339(verification.created_at_unix_ms),
        "date_updated": format_rfc3339(verification.updated_at_unix_ms),
        "sna_attempts_error_codes": [],
    })
}
