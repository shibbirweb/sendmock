use sendmock_sms::{
    CheckOutcome, MAXIMUM_SEND_ATTEMPTS, VerificationProgress, check_verification_code,
    generate_verification_code,
};
use sendmock_store::{VerificationRecord, VerificationTimelineRecord, VerifyServiceRecord};

use super::verification_code_delivery::{DeliveredCode, deliver_verification_code};
use super::verification_outcomes::{expire_overdue_verifications, publish_verification_event};
use crate::{AppEventType, OperationContext, OperationError};

/// A verification to start or resend.
pub struct VerificationStart<'start> {
    pub verify_service: &'start VerifyServiceRecord,
    pub to_address: &'start str,
    pub channel: &'start str,
    pub account_sid: Option<String>,
}

/// Why Twilio Verify refuses a start or a check, in its terms.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerifyRefusal {
    /// `60203`: too many sends to this recipient.
    MaxSendAttempts,
    /// `60202`: the fifth wrong code.
    MaxCheckAttempts,
    /// `20404`: unknown, expired or already finished.
    NotFound,
}

fn timeline_entry(kind: &str, at_unix_ms: i64, detail: String) -> VerificationTimelineRecord {
    VerificationTimelineRecord {
        kind: kind.to_owned(),
        at_unix_ms,
        detail,
    }
}

/// Starts a verification, or resends the code of the recipient's pending one, as Twilio does;
/// the sixth send to a recipient is refused.
pub async fn start_verification(
    operation_context: &OperationContext,
    verification_start: VerificationStart<'_>,
) -> Result<Result<VerificationRecord, VerifyRefusal>, OperationError> {
    expire_overdue_verifications(operation_context).await?;
    let verify_service = verification_start.verify_service;
    let pending_verification = operation_context
        .verification_repository
        .find_pending(&verify_service.service_sid, verification_start.to_address)
        .await?;
    if pending_verification
        .as_ref()
        .is_some_and(|pending| pending.send_attempts >= MAXIMUM_SEND_ATTEMPTS)
    {
        return Ok(Err(VerifyRefusal::MaxSendAttempts));
    }
    let code = match &pending_verification {
        Some(pending) => pending.code.clone(),
        None => generate_verification_code(
            verify_service.code_length,
            verify_service.fixed_code.as_deref(),
            operation_context.random_source.as_ref(),
        ),
    };
    let delivered_code = deliver_verification_code(
        operation_context,
        &verify_service.friendly_name,
        verification_start.to_address,
        verification_start.channel,
        &code,
    )
    .await?;
    let verification = match pending_verification {
        Some(pending) => {
            save_resend(
                operation_context,
                pending,
                verification_start.channel,
                delivered_code,
            )
            .await?
        }
        None => {
            insert_started(operation_context, &verification_start, code, delivered_code).await?
        }
    };
    publish_verification_event(
        operation_context,
        AppEventType::VerifyStarted,
        &verification,
    );
    Ok(Ok(verification))
}

async fn save_resend(
    operation_context: &OperationContext,
    pending: VerificationRecord,
    channel: &str,
    delivered_code: DeliveredCode,
) -> Result<VerificationRecord, OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let resent = VerificationRecord {
        channel: channel.to_owned(),
        send_attempts: pending.send_attempts + 1,
        linked_message_id: delivered_code.linked_message_id,
        linked_thread_id: delivered_code.linked_thread_id,
        updated_at_unix_ms: now_unix_ms,
        ..pending
    };
    let resend_entry = timeline_entry(
        "code_sent",
        now_unix_ms,
        format!("{} again", delivered_code.delivery_detail),
    );
    operation_context
        .verification_repository
        .save_progress(resent.clone(), vec![resend_entry])
        .await?;
    Ok(resent)
}

async fn insert_started(
    operation_context: &OperationContext,
    verification_start: &VerificationStart<'_>,
    code: String,
    delivered_code: DeliveredCode,
) -> Result<VerificationRecord, OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let verify_service = verification_start.verify_service;
    let started = VerificationRecord {
        verification_sid: generate_verification_sid(operation_context),
        service_sid: verify_service.service_sid.clone(),
        service_name: verify_service.friendly_name.clone(),
        account_sid: verification_start.account_sid.clone(),
        to_address: verification_start.to_address.to_owned(),
        channel: verification_start.channel.to_owned(),
        code,
        status: "pending".to_owned(),
        check_attempts: 0,
        send_attempts: 1,
        expires_at_unix_ms: now_unix_ms + i64::from(verify_service.ttl_seconds) * 1000,
        linked_message_id: delivered_code.linked_message_id,
        linked_thread_id: delivered_code.linked_thread_id,
        created_at_unix_ms: now_unix_ms,
        updated_at_unix_ms: now_unix_ms,
    };
    let timeline_entries = vec![
        timeline_entry(
            "started",
            now_unix_ms,
            format!(
                "Started for {} by {}",
                started.to_address, started.service_name
            ),
        ),
        timeline_entry("code_sent", now_unix_ms, delivered_code.delivery_detail),
    ];
    operation_context
        .verification_repository
        .insert_verification(started.clone(), timeline_entries)
        .await?;
    Ok(started)
}

/// Checks a code against a verification: approved, still pending after a wrong code, or failed
/// on the fifth wrong code.
pub async fn check_verification(
    operation_context: &OperationContext,
    verification: VerificationRecord,
    given_code: &str,
) -> Result<Result<VerificationRecord, VerifyRefusal>, OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let Some(checked_state) = read_checked_state(&verification, given_code, now_unix_ms) else {
        return Ok(Err(VerifyRefusal::NotFound));
    };
    let checked = VerificationRecord {
        status: checked_state.status.to_owned(),
        check_attempts: checked_state.check_attempts,
        updated_at_unix_ms: now_unix_ms,
        ..verification
    };
    let checked_entry = timeline_entry(
        checked_state.timeline_kind,
        now_unix_ms,
        checked_state.detail,
    );
    operation_context
        .verification_repository
        .save_progress(checked.clone(), vec![checked_entry])
        .await?;
    publish_verification_event(operation_context, AppEventType::VerifyChecked, &checked);
    if checked.status == "max_attempts_reached" {
        return Ok(Err(VerifyRefusal::MaxCheckAttempts));
    }
    Ok(Ok(checked))
}

/// The state after a check, or `None` when the verification cannot be checked any more.
struct CheckedState {
    status: &'static str,
    check_attempts: u32,
    timeline_kind: &'static str,
    detail: String,
}

fn read_checked_state(
    verification: &VerificationRecord,
    given_code: &str,
    now_unix_ms: i64,
) -> Option<CheckedState> {
    let progress = VerificationProgress {
        status: &verification.status,
        stored_code: &verification.code,
        check_attempts: verification.check_attempts,
        expires_at_unix_ms: verification.expires_at_unix_ms,
    };
    match check_verification_code(&progress, given_code, now_unix_ms) {
        CheckOutcome::Approved => Some(CheckedState {
            status: "approved",
            check_attempts: verification.check_attempts,
            timeline_kind: "approved",
            detail: "Approved with the right code".to_owned(),
        }),
        CheckOutcome::WrongCode { check_attempts } => Some(CheckedState {
            status: "pending",
            check_attempts,
            timeline_kind: "check_failed",
            detail: format!("Wrong code {}", given_code.trim()),
        }),
        CheckOutcome::MaxAttemptsReached => Some(CheckedState {
            status: "max_attempts_reached",
            check_attempts: verification.check_attempts + 1,
            timeline_kind: "max_attempts_reached",
            detail: "Too many wrong codes".to_owned(),
        }),
        CheckOutcome::Expired | CheckOutcome::NotPending => None,
    }
}

/// `VE` and 32 hex digits, as Twilio writes verification SIDs.
fn generate_verification_sid(operation_context: &OperationContext) -> String {
    let random_source = &operation_context.random_source;
    format!(
        "VE{:016x}{:016x}",
        random_source.next_u64(),
        random_source.next_u64()
    )
}
