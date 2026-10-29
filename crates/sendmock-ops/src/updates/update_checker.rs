use std::sync::{Arc, Mutex, PoisonError};

use sendmock_core::format_rfc3339;

use super::offered_release::{PublishedRelease, is_channel_checked, select_offered_release};
use super::release_source::ReleaseSource;
use super::update_check_result::{AvailableRelease, UpdateCheckResult};
use super::upgrade_command::{InstallMethod, build_upgrade_command};
use crate::{OperationContext, OperationError, UpdateCheckMode};

/// A successful check is reused this long before GitHub is asked again (PL-05.12).
const CACHE_DURATION_MS: i64 = 24 * 60 * 60 * 1000;
const RELEASE_PAGE_URL: &str = "https://github.com/shibbirweb/sendmock/releases/tag";

/// Runs the update check: never for edge and dev builds, from the cache for 24 hours, and
/// keeps only successful answers so an unreachable GitHub is asked again next time.
#[derive(Clone)]
pub struct UpdateChecker {
    release_source: Option<Arc<dyn ReleaseSource>>,
    install_method: InstallMethod,
    operating_system: &'static str,
    cached_check: Arc<Mutex<Option<(i64, UpdateCheckResult)>>>,
}

impl Default for UpdateChecker {
    fn default() -> Self {
        Self::new(None, InstallMethod::Unknown, std::env::consts::OS)
    }
}

impl UpdateChecker {
    pub fn new(
        release_source: Option<Arc<dyn ReleaseSource>>,
        install_method: InstallMethod,
        operating_system: &'static str,
    ) -> Self {
        Self {
            release_source,
            install_method,
            operating_system,
            cached_check: Arc::default(),
        }
    }

    pub async fn check(
        &self,
        operation_context: &OperationContext,
    ) -> Result<UpdateCheckResult, OperationError> {
        if operation_context
            .settings_store
            .current()
            .await?
            .update_check_mode
            == UpdateCheckMode::Off
        {
            return Err(OperationError::Conflict {
                code: "update_check_off",
                message: "Turn on the update check first".to_owned(),
            });
        }
        let now_unix_ms = operation_context.clock.now_unix_ms();
        if !is_channel_checked(operation_context.instance_details.channel) {
            return Ok(self.build_result(operation_context, &[], now_unix_ms));
        }
        if let Some(cached_result) = self.read_cache(now_unix_ms) {
            return Ok(cached_result);
        }
        let published_releases = match &self.release_source {
            Some(release_source) => release_source.fetch_releases().await.ok(),
            None => None,
        }
        .ok_or_else(|| OperationError::Upstream {
            code: "update_source_unreachable",
            message: "Could not check for updates".to_owned(),
        })?;
        let update_check_result =
            self.build_result(operation_context, &published_releases, now_unix_ms);
        *self
            .cached_check
            .lock()
            .unwrap_or_else(PoisonError::into_inner) =
            Some((now_unix_ms, update_check_result.clone()));
        Ok(update_check_result)
    }

    fn read_cache(&self, now_unix_ms: i64) -> Option<UpdateCheckResult> {
        let cached_check = self
            .cached_check
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        let (checked_at_unix_ms, cached_result) = cached_check.as_ref()?;
        (now_unix_ms - checked_at_unix_ms < CACHE_DURATION_MS).then(|| UpdateCheckResult {
            is_from_cache: true,
            ..cached_result.clone()
        })
    }

    fn build_result(
        &self,
        operation_context: &OperationContext,
        published_releases: &[PublishedRelease],
        checked_at_unix_ms: i64,
    ) -> UpdateCheckResult {
        let instance_details = &operation_context.instance_details;
        let offered_release = select_offered_release(
            instance_details.version,
            instance_details.channel,
            published_releases,
        );
        UpdateCheckResult {
            current_version: instance_details.version.to_owned(),
            channel: instance_details.channel,
            install_method: self.install_method,
            is_channel_checked: is_channel_checked(instance_details.channel),
            is_update_available: offered_release.is_some(),
            available_release: offered_release.map(|offered_release| AvailableRelease {
                version: offered_release.version.clone(),
                published_at: offered_release.published_at.clone(),
                release_notes_markdown: offered_release.release_notes_markdown.clone(),
                release_url: format!("{RELEASE_PAGE_URL}/v{}", offered_release.version),
                upgrade_command: build_upgrade_command(
                    self.install_method,
                    self.operating_system,
                    instance_details.channel,
                    &offered_release.version,
                ),
            }),
            checked_at: format_rfc3339(checked_at_unix_ms),
            is_from_cache: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;
    use std::pin::Pin;
    use std::sync::atomic::{AtomicUsize, Ordering};

    use sendmock_core::{FixedClock, SequentialIdGenerator};
    use sendmock_store::{Database, DatabaseLocation, EMBEDDED_MIGRATIONS};

    use super::*;
    use crate::{AppSettingsUpdate, InstanceDetails, ReleaseChannel};

    /// Answers a fixed release list, or fails like an unreachable GitHub; counts the calls.
    struct FixedReleaseSource {
        is_reachable: bool,
        fetch_count: AtomicUsize,
    }

    impl ReleaseSource for FixedReleaseSource {
        fn fetch_releases(
            &self,
        ) -> Pin<Box<dyn Future<Output = Result<Vec<PublishedRelease>, String>> + Send + '_>>
        {
            self.fetch_count.fetch_add(1, Ordering::SeqCst);
            let is_reachable = self.is_reachable;
            Box::pin(async move {
                if !is_reachable {
                    return Err("unreachable".to_owned());
                }
                Ok(vec![PublishedRelease {
                    version: "0.2.0".to_owned(),
                    published_at: "2026-10-28T00:00:00Z".to_owned(),
                    is_prerelease: false,
                    release_notes_markdown: "## 0.2.0".to_owned(),
                }])
            })
        }
    }

    async fn checker_context(
        is_reachable: bool,
        update_check_mode: UpdateCheckMode,
    ) -> (OperationContext, Arc<FixedReleaseSource>) {
        let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
            .unwrap_or_else(|error| panic!("{error}"));
        let release_source = Arc::new(FixedReleaseSource {
            is_reachable,
            fetch_count: AtomicUsize::new(0),
        });
        let operation_context = OperationContext::new(
            Arc::new(database),
            Arc::new(FixedClock::new(1_767_225_600_000)),
            Arc::new(SequentialIdGenerator::new(1_767_225_600_000)),
            InstanceDetails {
                version: "0.1.0",
                channel: ReleaseChannel::Stable,
                started_at_unix_ms: 0,
                http_address: "127.0.0.1:8025".to_owned(),
                smtp_address: "127.0.0.1:1025".to_owned(),
                provider_address: None,
                is_container: false,
            },
        )
        .with_update_checker(UpdateChecker::new(
            Some(release_source.clone()),
            InstallMethod::Homebrew,
            "macos",
        ));
        let mode_update = AppSettingsUpdate {
            update_check_mode: Some(update_check_mode),
            ..AppSettingsUpdate::default()
        };
        let current_settings = operation_context
            .settings_store
            .current()
            .await
            .unwrap_or_else(|error| panic!("{error}"));
        operation_context
            .settings_store
            .save(mode_update.apply_to(current_settings), 0)
            .await
            .unwrap_or_else(|error| panic!("{error}"));
        (operation_context, release_source)
    }

    // AC: PL-05.10
    #[tokio::test]
    async fn the_check_never_runs_while_it_is_off() {
        let (operation_context, release_source) = checker_context(true, UpdateCheckMode::Off).await;

        let check_outcome = operation_context
            .update_checker
            .check(&operation_context)
            .await;

        assert!(matches!(
            check_outcome,
            Err(OperationError::Conflict {
                code: "update_check_off",
                ..
            })
        ));
        assert_eq!(release_source.fetch_count.load(Ordering::SeqCst), 0);
    }

    // AC: PL-05.11
    // AC: PL-05.12
    #[tokio::test]
    async fn a_found_version_comes_with_its_notes_and_command_and_is_cached() {
        let (operation_context, release_source) =
            checker_context(true, UpdateCheckMode::Manual).await;

        let first_check = operation_context
            .update_checker
            .check(&operation_context)
            .await;
        let second_check = operation_context
            .update_checker
            .check(&operation_context)
            .await;

        let first_result = first_check.unwrap_or_else(|error| panic!("{error}"));
        let offered_release = first_result
            .available_release
            .clone()
            .unwrap_or_else(|| panic!("an offered release"));
        assert_eq!(offered_release.version, "0.2.0");
        assert_eq!(offered_release.release_notes_markdown, "## 0.2.0");
        assert_eq!(
            offered_release.upgrade_command.as_deref(),
            Some("brew upgrade shibbirweb/tap/sendmock")
        );
        assert!(second_check.is_ok_and(|second_result| second_result.is_from_cache));
        assert_eq!(release_source.fetch_count.load(Ordering::SeqCst), 1);
    }

    // AC: PL-05.12
    #[tokio::test]
    async fn an_unreachable_github_is_reported_and_asked_again_next_time() {
        let (operation_context, release_source) =
            checker_context(false, UpdateCheckMode::Daily).await;

        let first_check = operation_context
            .update_checker
            .check(&operation_context)
            .await;
        let _ = operation_context
            .update_checker
            .check(&operation_context)
            .await;

        assert!(matches!(
            first_check,
            Err(OperationError::Upstream {
                code: "update_source_unreachable",
                ..
            })
        ));
        assert_eq!(release_source.fetch_count.load(Ordering::SeqCst), 2);
    }
}
