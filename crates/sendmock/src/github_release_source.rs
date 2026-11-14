use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use sendmock_ops::{PublishedRelease, ReleaseSource};
use serde::Deserialize;

/// The public releases of SendMock; the check sends no identifiers, only this request.
pub const GITHUB_RELEASES_URL: &str =
    "https://api.github.com/repos/shibbirweb/sendmock/releases?per_page=30";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// One release as the GitHub REST API lists it; missing fields read as empty.
#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    body: Option<String>,
}

/// Reads published releases from GitHub Releases.
pub struct GitHubReleaseSource {
    releases_url: String,
    http_client: reqwest::Client,
}

impl GitHubReleaseSource {
    /// `None` when no HTTP client can be built, which the check reports as unreachable.
    pub fn new(releases_url: &str) -> Option<Self> {
        let http_client = reqwest::Client::builder()
            .user_agent("sendmock")
            .timeout(REQUEST_TIMEOUT)
            .build()
            .ok()?;
        Some(Self {
            releases_url: releases_url.to_owned(),
            http_client,
        })
    }
}

impl ReleaseSource for GitHubReleaseSource {
    fn fetch_releases(
        &self,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<PublishedRelease>, String>> + Send + '_>> {
        Box::pin(async move {
            let response = self
                .http_client
                .get(&self.releases_url)
                .header("Accept", "application/vnd.github+json")
                .send()
                .await
                .and_then(reqwest::Response::error_for_status)
                .map_err(|request_error| request_error.to_string())?;
            let releases_json = response
                .text()
                .await
                .map_err(|read_error| read_error.to_string())?;
            parse_releases(&releases_json)
        })
    }
}

/// Published releases from the API's JSON; drafts are skipped and the `v` of a tag dropped.
fn parse_releases(releases_json: &str) -> Result<Vec<PublishedRelease>, String> {
    let github_releases: Vec<GitHubRelease> =
        serde_json::from_str(releases_json).map_err(|parse_error| parse_error.to_string())?;
    Ok(github_releases
        .into_iter()
        .filter(|github_release| !github_release.draft)
        .map(|github_release| PublishedRelease {
            version: github_release.tag_name.trim_start_matches('v').to_owned(),
            published_at: github_release.published_at.unwrap_or_default(),
            is_prerelease: github_release.prerelease,
            release_notes_markdown: github_release.body.unwrap_or_default(),
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_releases_and_skips_drafts() -> Result<(), String> {
        let releases_json = r#"[
            { "tag_name": "v0.2.0-beta.1", "published_at": "2026-10-28T09:00:00Z", "prerelease": true, "draft": false, "body": "Release notes" },
            { "tag_name": "v0.3.0", "published_at": null, "prerelease": false, "draft": true, "body": null },
            { "tag_name": "v0.1.0", "prerelease": false }
        ]"#;

        let published_releases = parse_releases(releases_json)?;

        assert_eq!(published_releases.len(), 2);
        assert_eq!(published_releases[0].version, "0.2.0-beta.1");
        assert!(published_releases[0].is_prerelease);
        assert_eq!(
            published_releases[0].release_notes_markdown,
            "Release notes"
        );
        assert_eq!(published_releases[1].published_at, "");
        Ok(())
    }

    #[test]
    fn an_unexpected_answer_is_an_error() {
        assert!(parse_releases(r#"{"message": "API rate limit exceeded"}"#).is_err());
    }

    #[tokio::test]
    async fn fetches_from_the_releases_url() -> std::io::Result<()> {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
        let releases_url = format!("http://{}/releases", listener.local_addr()?);
        tokio::spawn(async move {
            if let Ok((mut stream, _)) = listener.accept().await {
                let mut request_bytes = [0_u8; 1024];
                let _ = stream.read(&mut request_bytes).await;
                let body = r#"[{"tag_name":"v9.9.9","prerelease":false}]"#;
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(response.as_bytes()).await;
            }
        });
        crate::tls_provider::install_tls_provider();
        let release_source = GitHubReleaseSource::new(&releases_url)
            .ok_or_else(|| std::io::Error::other("no client"))?;

        let published_releases = release_source
            .fetch_releases()
            .await
            .map_err(std::io::Error::other)?;

        assert_eq!(published_releases[0].version, "9.9.9");
        Ok(())
    }
}
