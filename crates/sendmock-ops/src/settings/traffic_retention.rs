use sendmock_mail::IngestOptions;
use sendmock_store::PrunableTable;

use super::app_settings::AppSettings;
use super::otp_extractor_cache::compile_otp_extractor;
use crate::{OperationContext, OperationError};

const MILLISECONDS_PER_DAY: i64 = 24 * 60 * 60 * 1000;

/// Deletes traffic past the count and age limits in Settings, never configuration (endpoints,
/// rules, templates, saved deliveries, numbers, providers, settings). Mail and its logs, HTTP
/// requests and finished webhook deliveries keep the newest `max_emails`; SMS and
/// verifications the newest `max_sms`. Answers how many rows went.
pub async fn prune_traffic(operation_context: &OperationContext) -> Result<u64, OperationError> {
    let settings = operation_context.settings_store.current().await?;
    let cutoff_unix_ms = settings.max_age_days.map(|max_age_days| {
        operation_context.clock.now_unix_ms() - i64::from(max_age_days) * MILLISECONDS_PER_DAY
    });
    let email_limit = Some(settings.max_emails);
    let sms_limit = Some(settings.max_sms);
    let limits_by_table = [
        (PrunableTable::EMAILS, email_limit),
        (PrunableTable::SMTP_SESSIONS, email_limit),
        (PrunableTable::API_REQUESTS, email_limit),
        (PrunableTable::HTTP_REQUESTS, email_limit),
        (PrunableTable::WEBHOOK_DELIVERIES, email_limit),
        (PrunableTable::SMS_MESSAGES, sms_limit),
        (PrunableTable::VERIFICATIONS, sms_limit),
    ];
    let traffic_pruner = &operation_context.traffic_pruner;
    let mut pruned_count = 0;
    for (prunable_table, max_count) in limits_by_table {
        pruned_count += traffic_pruner
            .prune(prunable_table, max_count, cutoff_unix_ms)
            .await?;
    }
    pruned_count += traffic_pruner.remove_orphans().await?;
    if pruned_count > 0 {
        traffic_pruner.reclaim_free_pages().await?;
    }
    Ok(pruned_count)
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
            .settings_store
            .otp_extractor_for(&settings),
        is_plus_address_tagging_enabled: settings.is_plus_address_tagging_enabled,
    })
}
