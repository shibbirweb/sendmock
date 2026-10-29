use std::time::Duration;

use sendmock_ops::{AppSettingsUpdate, OperationContext, prune_traffic};
use tokio::sync::watch;

use crate::config::ServerConfig;

/// Often enough that a burst of mail is trimmed within seconds, rarely enough to cost nothing.
const PRUNE_INTERVAL: Duration = Duration::from_secs(10);

/// Writes `--max-emails` and `--max-age` into the settings, so the UI shows the limits in force.
pub async fn apply_retention_flags(
    server_config: &ServerConfig,
    operation_context: &OperationContext,
) {
    let retention = &server_config.retention;
    if retention.max_emails.is_none() && retention.max_age_days.is_none() {
        return;
    }
    let retention_update = AppSettingsUpdate {
        max_emails: retention.max_emails,
        max_age_days: retention.max_age_days.map(Some),
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
        tracing::warn!(error = %store_error, "could not apply the retention limits");
    }
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
