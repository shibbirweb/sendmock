use sendmock_mail::IngestOptions;

use super::app_settings::AppSettings;
use super::otp_extractor_cache::compile_otp_extractor;
use crate::{OperationContext, OperationError};

const MILLISECONDS_PER_DAY: i64 = 24 * 60 * 60 * 1000;

/// Deletes traffic past the count and age limits in Settings: emails, SMTP sessions, logged
/// requests and SMS, never configuration. Answers how many rows went.
pub async fn prune_traffic(operation_context: &OperationContext) -> Result<u64, OperationError> {
    let settings = operation_context.settings_store.current().await?;
    let cutoff_unix_ms = settings.max_age_days.map(|max_age_days| {
        operation_context.clock.now_unix_ms() - i64::from(max_age_days) * MILLISECONDS_PER_DAY
    });
    let pruned_email_count = operation_context
        .email_repository
        .prune_emails(Some(settings.max_emails), cutoff_unix_ms)
        .await?;
    let pruned_session_count = operation_context
        .smtp_session_repository
        .prune_sessions(settings.max_emails, cutoff_unix_ms)
        .await?;
    let pruned_request_count = operation_context
        .api_request_repository
        .prune_requests(settings.max_emails, cutoff_unix_ms)
        .await?;
    let pruned_sms_count = operation_context
        .sms_repository
        .prune_messages(settings.max_sms, cutoff_unix_ms)
        .await?;
    Ok(pruned_email_count + pruned_session_count + pruned_request_count + pruned_sms_count)
}

/// How new mail is read with the current settings: their OTP patterns (the defaults when
/// none compile) and plus-address tagging.
pub fn build_ingest_options(settings: &AppSettings) -> IngestOptions {
    IngestOptions {
        otp_extractor: compile_otp_extractor(&settings.otp_patterns),
        is_plus_address_tagging_enabled: settings.is_plus_address_tagging_enabled,
    }
}

/// The ingest options for the next message, with the OTP patterns compiled once per change.
pub async fn read_ingest_options(
    operation_context: &OperationContext,
) -> Result<IngestOptions, OperationError> {
    let settings = operation_context.settings_store.current().await?;
    Ok(IngestOptions {
        otp_extractor: operation_context
            .otp_extractor_cache
            .otp_extractor_for(&settings.otp_patterns),
        is_plus_address_tagging_enabled: settings.is_plus_address_tagging_enabled,
    })
}
