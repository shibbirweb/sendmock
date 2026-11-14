use std::time::Duration;

use sendmock_ops::{AppSettingsUpdate, OperationContext, list_unbounded_traffic, prune_traffic};
use tokio::sync::watch;

use crate::config::{ServerConfig, StartupSettingsConfig};

/// Often enough that a burst of mail is trimmed within seconds, rarely enough to cost nothing.
const PRUNE_INTERVAL: Duration = Duration::from_secs(10);

/// Writes `--max-emails`, `--max-sms`, `--max-age`, `--update-check`, `--spamassassin`, `--relay-smtp` and `--relay-allowlist` into the settings, so the UI
/// shows the values in force, then warns when nothing bounds the stored traffic.
pub async fn apply_startup_settings(
    server_config: &ServerConfig,
    operation_context: &OperationContext,
) {
    write_startup_settings(server_config, operation_context).await;
    warn_about_unbounded_retention(operation_context).await;
}

async fn write_startup_settings(
    server_config: &ServerConfig,
    operation_context: &OperationContext,
) {
    let startup_settings = &server_config.startup_settings;
    if startup_settings == &StartupSettingsConfig::default() {
        return;
    }
    let retention_update = AppSettingsUpdate {
        max_emails: startup_settings.max_emails,
        max_sms: startup_settings.max_sms,
        max_age_days: startup_settings.max_age_days.map(Some),
        update_check_mode: startup_settings.update_check_mode,
        spamassassin_address: startup_settings.spamassassin_address.clone().map(Some),
        relay_smtp_url: startup_settings.relay_smtp_url.clone().map(Some),
        relay_recipient_allowlist: startup_settings.relay_recipient_allowlist.clone(),
        ..AppSettingsUpdate::default()
    };
    let saved = match operation_context.settings_store.current().await {
        Ok(current_settings) => {
            operation_context
                .settings_store
                .save(
                    retention_update.apply_to(current_settings),
                    operation_context.clock.now_unix_ms(),
                )
                .await
        }
        Err(store_error) => Err(store_error),
    };
    if let Err(store_error) = saved {
        tracing::warn!(error = %store_error, "could not apply the startup settings");
    }
}

/// Warns at startup when a count limit is 0 and no age limit is set, since nothing then stops
/// the database growing until the disk is full.
async fn warn_about_unbounded_retention(operation_context: &OperationContext) {
    let Ok(settings) = operation_context.settings_store.current().await else {
        return;
    };
    let unbounded_traffic = list_unbounded_traffic(&settings);
    if unbounded_traffic.is_empty() {
        return;
    }
    tracing::warn!(
        "no retention limit for {}: all of them are kept and the database grows until the disk is full; a fixed --max-emails, --max-sms or --max-age is recommended",
        unbounded_traffic.join(" and "),
    );
}

/// Prunes traffic past the limits in Settings until shutdown, off the ingest path.
pub async fn run_retention_task(
    operation_context: OperationContext,
    mut shutdown_requested: watch::Receiver<bool>,
) {
    let mut prune_timer = tokio::time::interval(PRUNE_INTERVAL);
    loop {
        let is_shutting_down = tokio::select! {
            _ = prune_timer.tick() => false,
            _ = shutdown_requested.wait_for(|is_requested| *is_requested) => true,
        };
        if is_shutting_down {
            break;
        }
        match prune_traffic(&operation_context).await {
            Ok(0) => {}
            Ok(pruned_count) => tracing::debug!(pruned_count, "pruned old traffic"),
            Err(prune_error) => tracing::warn!(error = %prune_error, "could not prune old traffic"),
        }
    }
}
