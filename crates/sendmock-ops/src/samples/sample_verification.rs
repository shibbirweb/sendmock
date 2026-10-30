use super::create_sample_operation::CreatedSample;
use crate::verify::{VerificationStart, new_verify_service, start_verification};
use crate::{OperationContext, OperationError};

const SAMPLE_SERVICE_NAME: &str = "SendMock";
const SAMPLE_RECIPIENT: &str = "+14155550100";

/// A verification started through the same flow as Twilio Verify: the first service (one named
/// SendMock is created when there is none) sends a code by SMS.
pub async fn create_sample_verification(
    operation_context: &OperationContext,
    recipient: Option<String>,
) -> Result<CreatedSample, OperationError> {
    let verify_service = match operation_context
        .verify_service_repository
        .list_services()
        .await?
        .into_iter()
        .next()
    {
        Some(verify_service) => verify_service,
        None => {
            let sample_service = sendmock_store::VerifyServiceRecord {
                friendly_name: SAMPLE_SERVICE_NAME.to_owned(),
                ..new_verify_service(operation_context)
            };
            operation_context
                .verify_service_repository
                .save_service(sample_service.clone())
                .await?;
            sample_service
        }
    };
    let to_address = recipient.unwrap_or_else(|| SAMPLE_RECIPIENT.to_owned());
    let verification = start_verification(
        operation_context,
        VerificationStart {
            verify_service: &verify_service,
            to_address: &to_address,
            channel: "sms",
            account_sid: None,
        },
    )
    .await?
    .map_err(|_| OperationError::Conflict {
        code: "max_send_attempts",
        message: format!("{to_address} has had the most codes allowed; check or cancel one first"),
    })?;
    Ok(CreatedSample {
        kind: "verification".to_owned(),
        id: verification.verification_sid,
    })
}
