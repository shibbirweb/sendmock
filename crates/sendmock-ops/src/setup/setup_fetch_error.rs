use crate::OperationError;

/// Why a setup could not be downloaded from its URL.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SetupFetchError {
    #[error("{url} is not a valid URL")]
    InvalidUrl { url: String },
    #[error(
        "A setup URL must start with https:// (plain http only for loopback and private addresses)"
    )]
    NotHttps,
    #[error(
        "Plain http is allowed only for loopback and private addresses, and {host} is neither; use https://"
    )]
    PlainHttpNotPrivate { host: String },
    #[error("{host} could not be found")]
    UnknownHost { host: String },
    #[error("The download redirected more than {maximum_redirects} times")]
    TooManyRedirects { maximum_redirects: usize },
    #[error("The download redirected to a URL that is not https://")]
    RedirectNotHttps,
    #[error("The download took longer than {timeout_seconds} seconds")]
    TimedOut { timeout_seconds: u64 },
    #[error("The setup is larger than {maximum_bytes} bytes")]
    TooLarge { maximum_bytes: usize },
    #[error("The server answered {status_code}")]
    UnsuccessfulStatus { status_code: u16 },
    #[error("The download failed: {reason}")]
    Unreachable { reason: String },
    #[error("The download is not UTF-8 text")]
    NotText,
}

impl From<SetupFetchError> for OperationError {
    fn from(fetch_error: SetupFetchError) -> Self {
        let message = fetch_error.to_string();
        let code = match fetch_error {
            SetupFetchError::InvalidUrl { .. } => {
                return Self::InvalidInput {
                    message,
                    field: Some("url".to_owned()),
                };
            }
            SetupFetchError::NotHttps
            | SetupFetchError::PlainHttpNotPrivate { .. }
            | SetupFetchError::TooManyRedirects { .. }
            | SetupFetchError::RedirectNotHttps => "setup_url_not_allowed",
            SetupFetchError::TooLarge { .. } | SetupFetchError::NotText => "setup_download_refused",
            SetupFetchError::UnknownHost { .. }
            | SetupFetchError::TimedOut { .. }
            | SetupFetchError::UnsuccessfulStatus { .. }
            | SetupFetchError::Unreachable { .. } => "setup_download_failed",
        };
        Self::Unprocessable { code, message }
    }
}
