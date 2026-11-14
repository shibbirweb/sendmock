use std::fmt;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sendmock_core::RandomSource;

const SECRET_PREFIX: &str = "whsec_";
const KEY_LENGTH_BYTES: usize = 24;
const MASK: &str = "••••";

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum WebhookSecretError {
    #[error("a webhook secret starts with whsec_ followed by base64")]
    InvalidFormat,
}

/// A Standard Webhooks signing secret: `whsec_` and the base64 of its key. Its `Debug` form is
/// masked, so it never reaches a log in full.
#[derive(Clone, PartialEq, Eq)]
pub struct WebhookSecret {
    encoded_secret: String,
    key_bytes: Vec<u8>,
}

impl WebhookSecret {
    /// A new secret with a 24-byte key from the random source.
    pub fn generate(random_source: &dyn RandomSource) -> Self {
        let key_bytes: Vec<u8> = (0..KEY_LENGTH_BYTES / 8)
            .flat_map(|_| random_source.next_u64().to_le_bytes())
            .collect();
        Self {
            encoded_secret: format!("{SECRET_PREFIX}{}", STANDARD.encode(&key_bytes)),
            key_bytes,
        }
    }

    pub fn parse(encoded_secret: &str) -> Result<Self, WebhookSecretError> {
        let encoded_key = encoded_secret
            .strip_prefix(SECRET_PREFIX)
            .ok_or(WebhookSecretError::InvalidFormat)?;
        let key_bytes = STANDARD
            .decode(encoded_key)
            .map_err(|_| WebhookSecretError::InvalidFormat)?;
        if key_bytes.is_empty() {
            return Err(WebhookSecretError::InvalidFormat);
        }
        Ok(Self {
            encoded_secret: encoded_secret.to_owned(),
            key_bytes,
        })
    }

    /// The full secret, for storage and the reveal operation only.
    pub fn expose(&self) -> &str {
        &self.encoded_secret
    }

    /// `whsec_••••` and the last four characters, as the UI and API show it.
    pub fn masked(&self) -> String {
        let last_characters: String = self
            .encoded_secret
            .chars()
            .rev()
            .take(4)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();
        format!("{SECRET_PREFIX}{MASK}{last_characters}")
    }

    pub(crate) fn key_bytes(&self) -> &[u8] {
        &self.key_bytes
    }
}

impl fmt::Debug for WebhookSecret {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.masked())
    }
}

#[cfg(test)]
mod tests {
    use sendmock_core::SeededRandomSource;

    use super::*;

    #[test]
    fn a_generated_secret_parses_back_with_a_24_byte_key() {
        let generated_secret = WebhookSecret::generate(&SeededRandomSource::new(7));

        let parsed_secret = WebhookSecret::parse(generated_secret.expose());

        assert_eq!(parsed_secret.as_ref(), Ok(&generated_secret));
        assert_eq!(generated_secret.key_bytes().len(), 24);
        assert!(generated_secret.expose().starts_with("whsec_"));
    }

    #[test]
    fn the_masked_form_keeps_only_the_prefix_and_last_four_characters() {
        let secret =
            WebhookSecret::parse("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw").expect("valid secret");

        assert_eq!(secret.masked(), "whsec_••••LaSw");
        assert_eq!(format!("{secret:?}"), "whsec_••••LaSw");
    }

    #[test]
    fn a_secret_without_the_prefix_or_with_bad_base64_is_refused() {
        assert_eq!(
            WebhookSecret::parse("MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"),
            Err(WebhookSecretError::InvalidFormat)
        );
        assert_eq!(
            WebhookSecret::parse("whsec_not base64!"),
            Err(WebhookSecretError::InvalidFormat)
        );
    }
}
