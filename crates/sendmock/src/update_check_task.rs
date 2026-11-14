use std::sync::Arc;
use std::time::Duration;

use sendmock_ops::{
    InstallMethod, OperationContext, ReleaseSource, UpdateCheckMode, UpdateChecker,
};
use tokio::sync::watch;

use crate::github_release_source::{GITHUB_RELEASES_URL, GitHubReleaseSource};

/// How often the daily check looks whether a day has passed; the 24-hour cache does the rest.
const DAILY_CHECK_INTERVAL: Duration = Duration::from_secs(60 * 60);

/// The update checker for this build: GitHub Releases, and the install method the package
/// baked in (`SENDMOCK_INSTALL_METHOD`).
pub fn build_update_checker() -> UpdateChecker {
    let release_source = GitHubReleaseSource::new(GITHUB_RELEASES_URL)
        .map(|release_source| Arc::new(release_source) as Arc<dyn ReleaseSource>);
    UpdateChecker::new(
        release_source,
        InstallMethod::from_build_setting(option_env!("SENDMOCK_INSTALL_METHOD")),
        std::env::consts::OS,
    )
}

/// In Daily mode, checks on start and then once a day, and logs a newer version once.
pub async fn run_update_check_task(
    operation_context: OperationContext,
    mut shutdown_requested: watch::Receiver<bool>,
) {
    let mut check_timer = tokio::time::interval(DAILY_CHECK_INTERVAL);
    let mut announced_version: Option<String> = None;
    loop {
        let is_shutting_down = tokio::select! {
            _ = check_timer.tick() => false,
            _ = shutdown_requested.wait_for(|is_requested| *is_requested) => true,
        };
        if is_shutting_down {
            break;
        }
        let is_daily = operation_context
            .settings_store
            .current()
            .await
            .is_ok_and(|settings| settings.update_check_mode == UpdateCheckMode::Daily);
        if !is_daily {
            continue;
        }
        let Ok(update_check_result) = operation_context
            .update_checker
            .check(&operation_context)
            .await
        else {
            continue;
        };
        if let Some(available_release) = update_check_result.available_release
            && announced_version.as_deref() != Some(available_release.version.as_str())
        {
            tracing::info!(version = %available_release.version, "a newer SendMock is available");
            announced_version = Some(available_release.version);
        }
    }
}
