use sendmock_store::{VerificationRecord, VerificationTimelineRecord};
use serde_json::json;

use crate::{AppEventType, OperationContext, OperationError, publish_event};

/// Sets a final status by hand (the Force buttons, or Twilio's update with `Status`).
pub async fn finish_verification(
    operation_context: &OperationContext,
    verification: VerificationRecord,
    final_status: &str,
    detail: &str,
) -> Result<VerificationRecord, OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let finished = VerificationRecord {
        status: final_status.to_owned(),
        updated_at_unix_ms: now_unix_ms,
        ..verification
    };
    operation_context
        .verification_repository
        .save_progress(
            finished.clone(),
            vec![VerificationTimelineRecord {
                kind: final_status.to_owned(),
                at_unix_ms: now_unix_ms,
                detail: detail.to_owned(),
            }],
        )
        .await?;
    let event_type = if final_status == "expired" {
        AppEventType::VerifyExpired
    } else {
        AppEventType::VerifyChecked
    };
    publish_verification_event(operation_context, event_type, &finished);
    Ok(finished)
}

/// Pending verifications past their deadline become `expired` and fire `verify.expired`.
pub async fn expire_overdue_verifications(
    operation_context: &OperationContext,
) -> Result<(), OperationError> {
    let expired_verifications = operation_context
        .verification_repository
        .expire_overdue(operation_context.clock.now_unix_ms())
        .await?;
    for expired_verification in &expired_verifications {
        let mut expired_verification = expired_verification.clone();
        expired_verification.status = "expired".to_owned();
        publish_verification_event(
            operation_context,
            AppEventType::VerifyExpired,
            &expired_verification,
        );
    }
    Ok(())
}

pub fn publish_verification_event(
    operation_context: &OperationContext,
    event_type: AppEventType,
    verification: &VerificationRecord,
) {
    publish_event(
        operation_context,
        event_type,
        json!({
            "sid": verification.verification_sid,
            "service_sid": verification.service_sid,
            "to": verification.to_address,
            "channel": verification.channel,
            "status": verification.status,
            "approved": verification.status == "approved",
        }),
    );
}
