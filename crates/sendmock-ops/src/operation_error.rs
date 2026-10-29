use sendmock_store::StoreError;

/// Why an operation failed, without HTTP status codes or exit codes; each surface maps it.
#[derive(Debug, thiserror::Error)]
pub enum OperationError {
    #[error("{message}")]
    InvalidInput {
        message: String,
        field: Option<String>,
    },

    #[error("{message}")]
    NotFound { message: String },

    #[error("{message}")]
    Timeout { message: String },

    /// The request clashes with the current state, such as a check that is turned off.
    #[error("{message}")]
    Conflict { code: &'static str, message: String },

    /// The request is well formed but refused, as a provider refuses a magic test number.
    #[error("{message}")]
    Rejected { code: &'static str, message: String },

    /// The input has the right shape but cannot be used, such as a template that does not
    /// render.
    #[error("{message}")]
    Unprocessable { code: &'static str, message: String },

    /// A service SendMock depends on, such as GitHub for the update check, could not answer.
    #[error("{message}")]
    Upstream { code: &'static str, message: String },

    #[error(transparent)]
    Store(#[from] StoreError),

    #[error("{0}")]
    Internal(String),
}

impl OperationError {
    /// The stable `error.code` of the API error body.
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidInput { .. } => "invalid_input",
            Self::NotFound { .. } => "not_found",
            Self::Timeout { .. } => "timeout",
            Self::Conflict { code, .. }
            | Self::Rejected { code, .. }
            | Self::Unprocessable { code, .. }
            | Self::Upstream { code, .. } => code,
            Self::Store(_) | Self::Internal(_) => "internal_error",
        }
    }

    pub fn field(&self) -> Option<&str> {
        match self {
            Self::InvalidInput { field, .. } => field.as_deref(),
            Self::NotFound { .. }
            | Self::Timeout { .. }
            | Self::Conflict { .. }
            | Self::Rejected { .. }
            | Self::Unprocessable { .. }
            | Self::Upstream { .. }
            | Self::Store(_)
            | Self::Internal(_) => None,
        }
    }
}
