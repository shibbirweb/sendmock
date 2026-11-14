use sendmock_mail::IngestOptions;
use sendmock_store::PrunableTable;

use super::app_settings::AppSettings;
use super::otp_extractor_cache::compile_otp_extractor;
use crate::events::publish_traffic_pruned;
use crate::{OperationContext, OperationError};

const MILLISECONDS_PER_DAY: i64 = 24 * 60 * 60 * 1000;

/// Deletes traffic past the count and age limits in Settings, never configuration (endpoints,
/// rules, templates, saved deliveries, numbers, providers, settings). Mail and its logs, HTTP
/// requests and finished webhook deliveries keep the newest `max_emails`; SMS, verifications
/// and push notifications the newest `max_sms`. A limit of 0 keeps every row (only the age
/// limit applies). Publishes `traffic.pruned` when any row went, and answers how many did.
pub async fn prune_traffic(operation_context: &OperationContext) -> Result<u64, OperationError> {
    let settings = operation_context.settings_store.current().await?;
    let cutoff_unix_ms = settings.max_age_days.map(|max_age_days| {
        operation_context.clock.now_unix_ms() - i64::from(max_age_days) * MILLISECONDS_PER_DAY
    });
    let email_limit = count_limit(settings.max_emails);
    let sms_limit = count_limit(settings.max_sms);
    let limits_by_table = [
        (PrunableTable::EMAILS, email_limit),
        (PrunableTable::SMTP_SESSIONS, email_limit),
        (PrunableTable::API_REQUESTS, email_limit),
        (PrunableTable::HTTP_REQUESTS, email_limit),
        (PrunableTable::WEBHOOK_DELIVERIES, email_limit),
        (PrunableTable::SMS_MESSAGES, sms_limit),
        (PrunableTable::VERIFICATIONS, sms_limit),
        (PrunableTable::PUSH_NOTIFICATIONS, sms_limit),
        (PrunableTable::WHATSAPP_MEDIA, sms_limit),
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
        publish_traffic_pruned(operation_context, pruned_count);
    }
    Ok(pruned_count)
}

/// 0 means no count limit, as Mailpit's `--max 0` does.
fn count_limit(max_count: u64) -> Option<u64> {
    (max_count > 0).then_some(max_count)
}

/// The kinds of traffic that nothing bounds: a count limit of 0 with no age limit, so the
/// database grows until the disk is full. Empty when every kind is bounded.
pub fn list_unbounded_traffic(settings: &AppSettings) -> Vec<&'static str> {
    if settings.max_age_days.is_some() {
        return Vec::new();
    }
    [("emails", settings.max_emails), ("SMS", settings.max_sms)]
        .into_iter()
        .filter(|(_, max_count)| *max_count == 0)
        .map(|(traffic_name, _)| traffic_name)
        .collect()
}

/// How new mail is read with the current settings: their OTP patterns (the defaults when
/// none compile) and plus-address tagging.
pub fn build_ingest_options(settings: &AppSettings) -> IngestOptions {
    IngestOptions {
        otp_extractor: compile_otp_extractor(&settings.otp_patterns),
        is_plus_address_tagging_enabled: settings.is_plus_address_tagging_enabled,
        project_key: sendmock_store::DEFAULT_PROJECT_KEY.to_owned(),
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
        project_key: operation_context.request.project_key.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-08.4
    #[test]
    fn a_limit_of_zero_means_no_count_limit() {
        assert_eq!(count_limit(0), None);
        assert_eq!(count_limit(1000), Some(1000));
    }

    // AC: PL-08.4
    #[test]
    fn traffic_without_a_count_or_age_limit_is_listed_as_unbounded() {
        let unlimited_email = AppSettings {
            max_emails: 0,
            max_age_days: None,
            ..AppSettings::default()
        };
        let unlimited_both = AppSettings {
            max_sms: 0,
            ..unlimited_email.clone()
        };
        let unlimited_with_age_limit = AppSettings {
            max_age_days: Some(7),
            ..unlimited_both.clone()
        };

        assert_eq!(list_unbounded_traffic(&unlimited_email), vec!["emails"]);
        assert_eq!(
            list_unbounded_traffic(&unlimited_both),
            vec!["emails", "SMS"]
        );
        assert!(list_unbounded_traffic(&unlimited_with_age_limit).is_empty());
        assert!(list_unbounded_traffic(&AppSettings::default()).is_empty());
    }
}
