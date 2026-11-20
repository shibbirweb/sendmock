#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::sync::{Arc, Mutex};

use sendmock_ops::{
    FetchedSetupFile, OperationContext, SetupFetchError, SetupFetchFuture, SetupFetchLimits,
    SetupFetchRequest, SetupFetcher, SetupFileFormat, SetupImportOptions, SetupRequestHeader,
    SetupUrlSource, apply_setup_text, download_setup,
};
use support::test_app::{build_test_app, build_test_app_with};

const SETUP_YAML: &str = "numbers:\n  - number: \"+15550001111\"\n    label: Support line\n";
/// The SHA-256 of `SETUP_YAML`.
const SETUP_YAML_SHA256: &str = "ad92717f9ff6b82f9d3b84a662da02f6523a3fbb91ddf953c137153ed0e224e3";
const OTHER_SHA256: &str = "0000000000000000000000000000000000000000000000000000000000000000";

/// Answers every download with one file, and keeps the requests it was given.
struct FixedSetupFetcher {
    fetch_answer: Result<FetchedSetupFile, SetupFetchError>,
    fetch_requests: Mutex<Vec<SetupFetchRequest>>,
}

impl SetupFetcher for FixedSetupFetcher {
    fn fetch_setup<'fetcher>(
        &'fetcher self,
        fetch_request: &'fetcher SetupFetchRequest,
    ) -> SetupFetchFuture<'fetcher> {
        if let Ok(mut fetch_requests) = self.fetch_requests.lock() {
            fetch_requests.push(fetch_request.clone());
        }
        let fetch_answer = self.fetch_answer.clone();
        Box::pin(async move { fetch_answer })
    }
}

fn build_app_answering(
    fetch_answer: Result<FetchedSetupFile, SetupFetchError>,
) -> (OperationContext, Arc<FixedSetupFetcher>) {
    let setup_fetcher = Arc::new(FixedSetupFetcher {
        fetch_answer,
        fetch_requests: Mutex::new(Vec::new()),
    });
    let shared_fetcher = Arc::clone(&setup_fetcher);
    let (_, operation_context) = build_test_app_with(|operation_context| {
        operation_context.with_setup_fetcher(shared_fetcher)
    });
    (operation_context, setup_fetcher)
}

fn yaml_file() -> FetchedSetupFile {
    FetchedSetupFile {
        bytes: SETUP_YAML.as_bytes().to_vec(),
        final_url: "https://example.com/team/setup.yaml".to_owned(),
        content_type: Some("text/plain".to_owned()),
    }
}

fn url_source(sha256: Option<String>) -> SetupUrlSource {
    SetupUrlSource {
        url: "https://example.com/team/setup".to_owned(),
        sha256,
        headers: vec![
            SetupRequestHeader::parse("Authorization: Bearer abc123")
                .unwrap_or_else(|error| panic!("a header: {error}")),
        ],
    }
}

// AC: PL-18.7
#[tokio::test]
async fn a_downloaded_setup_with_the_right_sha256_applies() {
    let (operation_context, setup_fetcher) = build_app_answering(Ok(yaml_file()));

    let downloaded_setup = download_setup(
        &operation_context,
        &url_source(Some(SETUP_YAML_SHA256.to_uppercase())),
    )
    .await
    .unwrap_or_else(|error| panic!("downloads: {error}"));
    let setup_format = downloaded_setup
        .named_format
        .unwrap_or_else(|| SetupFileFormat::detect(&downloaded_setup.setup_text));
    apply_setup_text(
        &operation_context,
        &downloaded_setup.setup_text,
        setup_format,
        SetupImportOptions::default(),
    )
    .await
    .unwrap_or_else(|error| panic!("applies: {error}"));

    assert_eq!(downloaded_setup.named_format, Some(SetupFileFormat::Yaml));
    let fetch_requests = setup_fetcher
        .fetch_requests
        .lock()
        .map(|fetch_requests| fetch_requests.clone())
        .unwrap_or_default();
    assert_eq!(fetch_requests.len(), 1);
    assert_eq!(fetch_requests[0].limits, SetupFetchLimits::default());
    assert_eq!(fetch_requests[0].headers[0].value, "Bearer abc123");
    let numbers = operation_context
        .virtual_number_repository
        .list_numbers()
        .await
        .unwrap_or_else(|error| panic!("numbers: {error}"));
    assert_eq!(numbers.len(), 1);
}

// AC: PL-18.7
#[tokio::test]
async fn a_sha256_that_does_not_match_is_refused() {
    let (operation_context, _) = build_app_answering(Ok(yaml_file()));

    let download_error = download_setup(
        &operation_context,
        &url_source(Some(OTHER_SHA256.to_owned())),
    )
    .await
    .err()
    .unwrap_or_else(|| panic!("a wrong digest must be refused"));

    assert_eq!(download_error.code(), "setup_checksum_mismatch");
    assert!(download_error.to_string().contains(SETUP_YAML_SHA256));
}

// AC: PL-18.7
#[tokio::test]
async fn a_refused_download_names_why_and_never_shows_the_header_value() {
    let (operation_context, _) = build_app_answering(Err(SetupFetchError::TooLarge {
        maximum_bytes: 1024 * 1024,
    }));

    let download_error = download_setup(&operation_context, &url_source(None))
        .await
        .err()
        .unwrap_or_else(|| panic!("a refused download must fail"));

    assert_eq!(download_error.code(), "setup_download_refused");
    assert!(!download_error.to_string().contains("abc123"));
    assert!(!format!("{:?}", url_source(None)).contains("abc123"));
}

#[tokio::test]
async fn without_a_downloader_a_url_cannot_be_imported() {
    let (_, operation_context) = build_test_app();

    let download_error = download_setup(&operation_context, &url_source(None))
        .await
        .err()
        .unwrap_or_else(|| panic!("no downloader"));

    assert_eq!(download_error.code(), "setup_download_unavailable");
}
