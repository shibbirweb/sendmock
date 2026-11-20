use std::sync::Arc;

use sendmock_core::RandomSource;

use super::setup_secret_cipher::SetupSecretKey;
use super::setup_secret_error::SetupSecretError;
use crate::OperationError;

/// What an export writes in place of each secret (Strategy): an `${ENV_VAR}` reference, so a
/// shared file holds none, or the secret encrypted with a passphrase. Never the plain text.
pub trait SetupSecretWriter: Send + Sync {
    /// `secret_name` names the secret within the file, such as an endpoint's name.
    fn write_secret(&self, secret_name: &str, secret_value: &str)
    -> Result<String, OperationError>;
}

/// `${NAME_SECRET}`, from the secret's name; the default.
pub struct SecretReferenceWriter;

impl SetupSecretWriter for SecretReferenceWriter {
    fn write_secret(
        &self,
        secret_name: &str,
        _secret_value: &str,
    ) -> Result<String, OperationError> {
        Ok(to_secret_reference(secret_name))
    }
}

/// "Laravel inbound mail" gives `${LARAVEL_INBOUND_MAIL_SECRET}`.
fn to_secret_reference(secret_name: &str) -> String {
    let variable_words: Vec<String> = secret_name
        .to_ascii_uppercase()
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_owned)
        .collect();
    format!("${{{}_SECRET}}", variable_words.join("_"))
}

/// `encrypted:v1:...`, for moving a setup to your own machine: every secret of one export is
/// sealed with one key from the passphrase and a random salt, each under its own nonce.
pub struct EncryptedSecretWriter {
    secret_key: SetupSecretKey,
    random_source: Arc<dyn RandomSource>,
}

impl EncryptedSecretWriter {
    pub fn new(
        passphrase: &str,
        random_source: Arc<dyn RandomSource>,
    ) -> Result<Self, SetupSecretError> {
        Ok(Self {
            secret_key: SetupSecretKey::generate(passphrase, random_source.as_ref())?,
            random_source,
        })
    }
}

impl SetupSecretWriter for EncryptedSecretWriter {
    fn write_secret(
        &self,
        _secret_name: &str,
        secret_value: &str,
    ) -> Result<String, OperationError> {
        Ok(self
            .secret_key
            .seal_secret(secret_value, self.random_source.as_ref())?
            .to_text())
    }
}

#[cfg(test)]
mod tests {
    use sendmock_core::SeededRandomSource;

    use super::*;
    use crate::setup::setup_secret_cipher::EncryptedSecret;

    #[test]
    fn the_default_writes_a_reference_named_after_the_secret() {
        assert_eq!(
            SecretReferenceWriter
                .write_secret("Laravel inbound mail", "whsec_abc")
                .ok(),
            Some("${LARAVEL_INBOUND_MAIL_SECRET}".to_owned())
        );
        assert_eq!(
            SecretReferenceWriter
                .write_secret("twilio auth-token", "abc")
                .ok(),
            Some("${TWILIO_AUTH_TOKEN_SECRET}".to_owned())
        );
    }

    // AC: PL-18.6
    #[test]
    fn the_encrypted_writer_never_writes_the_plain_text() {
        let secret_writer = EncryptedSecretWriter::new(
            "correct horse battery",
            Arc::new(SeededRandomSource::new(5)),
        )
        .unwrap_or_else(|error| panic!("a writer: {error}"));

        let first_text = secret_writer
            .write_secret("Billing", "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw")
            .unwrap_or_else(|error| panic!("written: {error}"));
        let second_text = secret_writer
            .write_secret("Billing", "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw")
            .unwrap_or_else(|error| panic!("written: {error}"));

        assert!(!first_text.contains("MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"));
        assert!(EncryptedSecret::parse(&first_text).is_ok());
        assert_ne!(first_text, second_text, "each secret gets its own nonce");
    }
}
