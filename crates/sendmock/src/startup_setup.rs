//! `--setup <path|url>` (`SENDMOCK_SETUP`): a setup file applied at startup, before SendMock
//! reports ready, so a CI service container needs one variable (WH-15.1).

use std::path::Path;

use sendmock_ops::{
    ImportSetupOperation, Operation, OperationContext, SetupFileFormat, SetupImportMode,
    SetupImportRequest,
};

use crate::cli_arguments::ServeArguments;
use crate::startup_error::StartupError;

/// Opens a setup's encrypted secrets, as `sendmock setup import` reads it.
const PASSPHRASE_VARIABLE: &str = "SENDMOCK_SETUP_PASSPHRASE";

/// Where the setup comes from, with what a private URL needs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StartupSetupSource {
    /// A file path, or an `https://` URL.
    pub location: String,
    /// The SHA-256 a download must have.
    pub sha256: Option<String>,
    /// `Name: value` headers for a private URL; never logged.
    pub headers: Vec<String>,
}

impl StartupSetupSource {
    /// `None` without `--setup`; blank header lines are dropped.
    pub fn from_arguments(serve_arguments: &ServeArguments) -> Option<Self> {
        let location = serve_arguments.setup_location.as_deref()?.trim();
        if location.is_empty() {
            return None;
        }
        Some(Self {
            location: location.to_owned(),
            sha256: serve_arguments.setup_sha256.clone(),
            headers: serve_arguments
                .setup_headers
                .iter()
                .filter(|header_line| !header_line.trim().is_empty())
                .cloned()
                .collect(),
        })
    }

    fn is_url(&self) -> bool {
        let location = self.location.trim();
        location.starts_with("https://") || location.starts_with("http://")
    }

    /// Where it came from, for logs: a URL without its query.
    fn describe(&self) -> String {
        self.location
            .split(['?', '#'])
            .next()
            .unwrap_or_default()
            .to_owned()
    }

    fn build_import_request(&self) -> Result<SetupImportRequest, StartupError> {
        let passphrase = std::env::var(PASSPHRASE_VARIABLE)
            .ok()
            .filter(|passphrase| !passphrase.is_empty());
        if self.is_url() {
            return Ok(SetupImportRequest {
                url: Some(self.location.trim().to_owned()),
                sha256: self.sha256.clone(),
                headers: self.headers.clone(),
                passphrase,
                mode: SetupImportMode::Merge,
                ..SetupImportRequest::default()
            });
        }
        let setup_path = Path::new(self.location.trim());
        let setup_text =
            std::fs::read_to_string(setup_path).map_err(|read_error| StartupError::Setup {
                location: self.describe(),
                reason: read_error.to_string(),
            })?;
        Ok(SetupImportRequest {
            setup_text: Some(setup_text),
            format: setup_path
                .file_name()
                .and_then(|file_name| file_name.to_str())
                .and_then(SetupFileFormat::from_file_name),
            passphrase,
            mode: SetupImportMode::Merge,
            ..SetupImportRequest::default()
        })
    }
}

/// Applies the setup, merging it over the seed; any problem stops startup with the reason.
pub async fn apply_startup_setup(
    setup_source: &StartupSetupSource,
    operation_context: &OperationContext,
) -> Result<(), StartupError> {
    let import_request = setup_source.build_import_request()?;
    ImportSetupOperation
        .execute(operation_context, import_request)
        .await
        .map_err(|import_error| StartupError::Setup {
            location: setup_source.describe(),
            reason: import_error.to_string(),
        })?;
    tracing::info!(setup = %setup_source.describe(), "Setup applied");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_url_is_logged_without_its_query_and_a_path_is_read_as_a_file() {
        let url_source = StartupSetupSource {
            location: "https://example.test/sendmock.setup.yml?token=secret".to_owned(),
            sha256: None,
            headers: Vec::new(),
        };
        let path_source = StartupSetupSource {
            location: "sendmock.setup.yml".to_owned(),
            ..url_source.clone()
        };

        assert!(url_source.is_url());
        assert_eq!(
            url_source.describe(),
            "https://example.test/sendmock.setup.yml"
        );
        assert!(!path_source.is_url());
    }
}
