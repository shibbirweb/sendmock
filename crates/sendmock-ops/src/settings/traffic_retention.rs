use sendmock_mail::{IngestOptions, OtpExtractor};

use super::app_settings::AppSettings;
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
    let pattern_texts: Vec<&str> = settings.otp_patterns.iter().map(String::as_str).collect();
    IngestOptions {
        otp_extractor: OtpExtractor::with_patterns(&pattern_texts)
            .unwrap_or_else(|_| OtpExtractor::with_default_patterns()),
        is_plus_address_tagging_enabled: settings.is_plus_address_tagging_enabled,
    }
}

/// The ingest options for the next message.
pub async fn read_ingest_options(
    operation_context: &OperationContext,
) -> Result<IngestOptions, OperationError> {
    Ok(build_ingest_options(
        &operation_context.settings_store.current().await?,
    ))
}
