use std::fmt::Write as _;

use sha2::{Digest, Sha256};

use super::setup_fetch_error::SetupFetchError;
use super::setup_fetcher::{SetupFetchLimits, SetupFetchRequest, SetupRequestHeader};
use super::setup_file_format::SetupFileFormat;
use crate::{OperationContext, OperationError};

const SHA256_HEX_LENGTH: usize = 64;

/// Where to download a setup from: an `https://` URL (plain http for loopback and private
/// addresses), the SHA-256 it must have, and headers for a private URL.
#[derive(Debug, Clone, Default)]
pub struct SetupUrlSource {
    pub url: String,
    pub sha256: Option<String>,
    pub headers: Vec<SetupRequestHeader>,
}

/// A downloaded setup's text, and the format its URL or content type names, if any.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DownloadedSetup {
    pub setup_text: String,
    pub named_format: Option<SetupFileFormat>,
    pub final_url: String,
}

/// Downloads the setup within the fetch limits and checks its SHA-256 when one is given;
/// nothing is applied here, so a refused download changes nothing.
pub async fn download_setup(
    operation_context: &OperationContext,
    url_source: &SetupUrlSource,
) -> Result<DownloadedSetup, OperationError> {
    let expected_digest = url_source
        .sha256
        .as_deref()
        .map(read_sha256_digest)
        .transpose()?;
    let setup_fetcher = operation_context
        .setup_stores
        .fetcher
        .as_ref()
        .ok_or_else(|| OperationError::Unprocessable {
            code: "setup_download_unavailable",
            message: "This SendMock cannot download setups; import the file instead".to_owned(),
        })?;
    tracing::info!(
        url = %describe_url_for_log(&url_source.url),
        headers = ?url_source.headers,
        "downloading a setup"
    );
    let fetch_request = SetupFetchRequest {
        url: url_source.url.trim().to_owned(),
        headers: url_source.headers.clone(),
        limits: SetupFetchLimits::default(),
    };
    let fetched_file = setup_fetcher.fetch_setup(&fetch_request).await?;
    if let Some(expected_digest) = expected_digest {
        let actual_digest = write_sha256_digest(&fetched_file.bytes);
        if actual_digest != expected_digest {
            return Err(OperationError::Unprocessable {
                code: "setup_checksum_mismatch",
                message: format!(
                    "The download's SHA-256 is {actual_digest}, not the expected {expected_digest}; nothing was applied"
                ),
            });
        }
    }
    let named_format = read_format_from_url(&fetched_file.final_url).or_else(|| {
        fetched_file
            .content_type
            .as_deref()
            .and_then(read_format_from_content_type)
    });
    let setup_text = String::from_utf8(fetched_file.bytes).map_err(|_| SetupFetchError::NotText)?;
    Ok(DownloadedSetup {
        setup_text,
        named_format,
        final_url: fetched_file.final_url,
    })
}

/// Takes 64 hex digits in either case, with or without a `sha256:` prefix.
fn read_sha256_digest(sha256_text: &str) -> Result<String, OperationError> {
    let trimmed_text = sha256_text.trim();
    let digest_text = trimmed_text
        .strip_prefix("sha256:")
        .unwrap_or(trimmed_text)
        .to_ascii_lowercase();
    let is_digest = digest_text.len() == SHA256_HEX_LENGTH
        && digest_text
            .chars()
            .all(|character| character.is_ascii_hexdigit());
    if !is_digest {
        return Err(OperationError::InvalidInput {
            message: "sha256 must be 64 hexadecimal digits".to_owned(),
            field: Some("sha256".to_owned()),
        });
    }
    Ok(digest_text)
}

fn write_sha256_digest(file_bytes: &[u8]) -> String {
    Sha256::digest(file_bytes).iter().fold(
        String::with_capacity(SHA256_HEX_LENGTH),
        |mut digest_text, byte| {
            let _ = write!(digest_text, "{byte:02x}");
            digest_text
        },
    )
}

fn read_format_from_url(url: &str) -> Option<SetupFileFormat> {
    let without_query = url.split(['?', '#']).next().unwrap_or(url);
    let (_, after_scheme) = without_query.split_once("://")?;
    let (_, url_path) = after_scheme.split_once('/')?;
    let file_name = url_path.rsplit('/').next()?;
    SetupFileFormat::from_file_name(file_name)
}

fn read_format_from_content_type(content_type: &str) -> Option<SetupFileFormat> {
    let media_type = content_type.split(';').next()?.trim().to_ascii_lowercase();
    match media_type.as_str() {
        "application/json" => Some(SetupFileFormat::Json),
        "application/yaml" | "application/x-yaml" | "text/yaml" | "text/x-yaml" => {
            Some(SetupFileFormat::Yaml)
        }
        "application/toml" => Some(SetupFileFormat::Toml),
        _ => None,
    }
}

/// The URL without its user, password and query, which may carry a token.
fn describe_url_for_log(url: &str) -> String {
    let without_query = url.split(['?', '#']).next().unwrap_or(url);
    let Some((scheme, after_scheme)) = without_query.split_once("://") else {
        return without_query.to_owned();
    };
    let (authority, url_path) = after_scheme
        .split_once('/')
        .map_or((after_scheme, ""), |(authority, url_path)| {
            (authority, url_path)
        });
    let host = authority.rsplit('@').next().unwrap_or(authority);
    format!("{scheme}://{host}/{url_path}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_sha256_in_either_case_with_or_without_its_prefix() {
        let digest = "ab".repeat(32);

        assert_eq!(read_sha256_digest(&digest).ok(), Some(digest.clone()));
        assert_eq!(
            read_sha256_digest(&format!("sha256:{}", digest.to_uppercase())).ok(),
            Some(digest)
        );
        assert!(read_sha256_digest("abc").is_err());
        assert!(read_sha256_digest(&"zz".repeat(32)).is_err());
    }

    #[test]
    fn writes_the_sha256_of_the_bytes() {
        assert_eq!(
            write_sha256_digest(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn names_the_format_from_the_url_or_the_content_type() {
        assert_eq!(
            read_format_from_url("https://example.com/team/setup.yaml?token=x"),
            Some(SetupFileFormat::Yaml)
        );
        assert_eq!(read_format_from_url("https://example.com"), None);
        assert_eq!(read_format_from_url("https://example.com/raw/setup"), None);
        assert_eq!(
            read_format_from_content_type("application/json; charset=utf-8"),
            Some(SetupFileFormat::Json)
        );
        assert_eq!(read_format_from_content_type("text/plain"), None);
    }

    // AC: PL-18.7
    #[test]
    fn logs_the_url_without_its_user_password_or_query() {
        assert_eq!(
            describe_url_for_log("https://user:pass@example.com/setup.toml?token=abc"),
            "https://example.com/setup.toml"
        );
    }
}
