use super::setup_secret_cipher::MINIMUM_PASSPHRASE_LENGTH;
use crate::OperationError;

/// Why a setup's secrets could not be encrypted or opened.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SetupSecretError {
    #[error(
        "This setup holds encrypted secrets; give the passphrase it was exported with to import it"
    )]
    PassphraseRequired,
    #[error("The passphrase does not open this setup's encrypted secrets")]
    WrongPassphrase,
    #[error("The passphrase must be at least {MINIMUM_PASSPHRASE_LENGTH} characters")]
    PassphraseTooShort,
    #[error("{encrypted_text} is not a valid encrypted secret")]
    MalformedSecret { encrypted_text: String },
    #[error("The cipher for encrypted secrets is not available")]
    CipherUnavailable,
}

impl From<SetupSecretError> for OperationError {
    fn from(secret_error: SetupSecretError) -> Self {
        let message = secret_error.to_string();
        match secret_error {
            SetupSecretError::PassphraseRequired => Self::Unprocessable {
                code: "setup_passphrase_required",
                message,
            },
            SetupSecretError::WrongPassphrase => Self::Unprocessable {
                code: "setup_passphrase_wrong",
                message,
            },
            SetupSecretError::PassphraseTooShort => Self::InvalidInput {
                message,
                field: Some("passphrase".to_owned()),
            },
            SetupSecretError::MalformedSecret { .. } => Self::Unprocessable {
                code: "invalid_seed",
                message,
            },
            SetupSecretError::CipherUnavailable => Self::Internal(message),
        }
    }
}
