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
            Self::Store(_) | Self::Internal(_) => "internal_error",
        }
    }

    pub fn field(&self) -> Option<&str> {
        match self {
            Self::InvalidInput { field, .. } => field.as_deref(),
            Self::NotFound { .. } | Self::Timeout { .. } | Self::Store(_) | Self::Internal(_) => {
                None
            }
        }
    }
}
