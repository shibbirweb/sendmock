use std::cmp::Ordering;

use super::version_order::compare_versions;
use crate::ReleaseChannel;

/// One entry of GitHub Releases, as the update check reads it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublishedRelease {
    pub version: String,
    pub published_at: String,
    pub is_prerelease: bool,
    pub release_notes_markdown: String,
}

/// Edge and dev builds are offered nothing.
pub fn is_channel_checked(release_channel: ReleaseChannel) -> bool {
    matches!(
        release_channel,
        ReleaseChannel::Stable | ReleaseChannel::Beta
    )
}

/// Stable installs get the newest stable, beta installs the newer of the newest beta and
/// the newest stable, and only when it is newer than the running version (PL-05.12).
pub fn select_offered_release<'releases>(
    current_version: &str,
    release_channel: ReleaseChannel,
    published_releases: &'releases [PublishedRelease],
) -> Option<&'releases PublishedRelease> {
    if !is_channel_checked(release_channel) {
        return None;
    }
    published_releases
        .iter()
        .filter(|published_release| {
            release_channel == ReleaseChannel::Beta || !published_release.is_prerelease
        })
        .max_by(|left_release, right_release| {
            compare_versions(&left_release.version, &right_release.version)
        })
        .filter(|newest_release| {
            compare_versions(&newest_release.version, current_version) == Ordering::Greater
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(version: &str, is_prerelease: bool) -> PublishedRelease {
        PublishedRelease {
            version: version.to_owned(),
            published_at: "2026-10-28T00:00:00Z".to_owned(),
            is_prerelease,
            release_notes_markdown: String::new(),
        }
    }

    fn offered_version(current_version: &str, release_channel: ReleaseChannel) -> Option<String> {
        let published_releases = [
            release("0.1.0", false),
            release("0.2.0-beta.1", true),
            release("0.1.1", false),
        ];
        select_offered_release(current_version, release_channel, &published_releases)
            .map(|offered| offered.version.clone())
    }

    // AC: PL-05.12
    #[test]
    fn each_channel_is_offered_only_its_own_releases() {
        assert_eq!(
            offered_version("0.1.0", ReleaseChannel::Stable).as_deref(),
            Some("0.1.1")
        );
        assert_eq!(
            offered_version("0.1.0", ReleaseChannel::Beta).as_deref(),
            Some("0.2.0-beta.1")
        );
        assert_eq!(offered_version("0.1.0", ReleaseChannel::Edge), None);
        assert_eq!(offered_version("0.1.0", ReleaseChannel::Dev), None);
        assert_eq!(offered_version("0.2.0", ReleaseChannel::Beta), None);
    }
}
