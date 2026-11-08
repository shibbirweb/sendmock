use std::future::Future;
use std::pin::Pin;

use super::offered_release::PublishedRelease;

/// Where published releases come from: GitHub Releases in the binary, a fixed list in tests.
pub trait ReleaseSource: Send + Sync {
    fn fetch_releases(
        &self,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<PublishedRelease>, String>> + Send + '_>>;
}
