use std::num::NonZeroU32;

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use ring::aead::{AES_256_GCM, Aad, LessSafeKey, NONCE_LEN, Nonce, UnboundKey};
use ring::pbkdf2;
use sendmock_core::RandomSource;

use super::setup_secret_error::SetupSecretError;

/// Starts every encrypted secret in a setup file. `v1` fixes the scheme below, so a later
/// scheme gets a new prefix and files written with this one keep opening.
pub const ENCRYPTED_SECRET_PREFIX: &str = "encrypted:v1:";
/// The shortest passphrase an export accepts.
pub const MINIMUM_PASSPHRASE_LENGTH: usize = 8;
/// OWASP's recommendation for PBKDF2-HMAC-SHA256.
const KEY_DERIVATION_ITERATIONS: NonZeroU32 = match NonZeroU32::new(600_000) {
    Some(iteration_count) => iteration_count,
    None => NonZeroU32::MIN,
};
const SALT_LENGTH_BYTES: usize = 16;
const KEY_LENGTH_BYTES: usize = 32;
const PART_SEPARATOR: char = ':';

/// One encrypted secret as a setup file holds it: `encrypted:v1:<salt>:<nonce, ciphertext and
/// tag>`, both parts URL-safe base64. Each secret carries its salt, so an item copied into
/// another file still opens with the passphrase it was exported with.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EncryptedSecret {
    salt: [u8; SALT_LENGTH_BYTES],
    sealed_bytes: Vec<u8>,
}

impl EncryptedSecret {
    pub fn parse(encrypted_text: &str) -> Result<Self, SetupSecretError> {
        let malformed = || SetupSecretError::MalformedSecret {
            encrypted_text: encrypted_text.to_owned(),
        };
        let encoded_parts = encrypted_text
            .strip_prefix(ENCRYPTED_SECRET_PREFIX)
            .ok_or_else(malformed)?;
        let (encoded_salt, encoded_sealed_bytes) = encoded_parts
            .split_once(PART_SEPARATOR)
            .ok_or_else(malformed)?;
        let salt: [u8; SALT_LENGTH_BYTES] = URL_SAFE_NO_PAD
            .decode(encoded_salt)
            .ok()
            .and_then(|salt_bytes| salt_bytes.try_into().ok())
            .ok_or_else(malformed)?;
        let sealed_bytes = URL_SAFE_NO_PAD
            .decode(encoded_sealed_bytes)
            .ok()
            .filter(|sealed_bytes| sealed_bytes.len() >= NONCE_LEN + AES_256_GCM.tag_len())
            .ok_or_else(malformed)?;
        Ok(Self { salt, sealed_bytes })
    }

    pub fn salt(&self) -> &[u8; SALT_LENGTH_BYTES] {
        &self.salt
    }

    pub fn to_text(&self) -> String {
        format!(
            "{ENCRYPTED_SECRET_PREFIX}{}{PART_SEPARATOR}{}",
            URL_SAFE_NO_PAD.encode(self.salt),
            URL_SAFE_NO_PAD.encode(&self.sealed_bytes)
        )
    }
}

/// The key a passphrase gives with one salt (PBKDF2-HMAC-SHA256), which seals and opens
/// secrets with AES-256-GCM.
pub struct SetupSecretKey {
    salt: [u8; SALT_LENGTH_BYTES],
    sealing_key: LessSafeKey,
}

impl SetupSecretKey {
    /// A key with a new random salt, for an export.
    pub fn generate(
        passphrase: &str,
        random_source: &dyn RandomSource,
    ) -> Result<Self, SetupSecretError> {
        if passphrase.chars().count() < MINIMUM_PASSPHRASE_LENGTH {
            return Err(SetupSecretError::PassphraseTooShort);
        }
        let mut salt = [0_u8; SALT_LENGTH_BYTES];
        fill_random_bytes(&mut salt, random_source);
        Self::derive(passphrase, salt)
    }

    /// The key an encrypted secret was sealed with, from its salt.
    pub fn derive(
        passphrase: &str,
        salt: [u8; SALT_LENGTH_BYTES],
    ) -> Result<Self, SetupSecretError> {
        let mut key_bytes = [0_u8; KEY_LENGTH_BYTES];
        pbkdf2::derive(
            pbkdf2::PBKDF2_HMAC_SHA256,
            KEY_DERIVATION_ITERATIONS,
            &salt,
            passphrase.as_bytes(),
            &mut key_bytes,
        );
        let unbound_key = UnboundKey::new(&AES_256_GCM, &key_bytes)
            .map_err(|_| SetupSecretError::CipherUnavailable)?;
        Ok(Self {
            salt,
            sealing_key: LessSafeKey::new(unbound_key),
        })
    }

    pub fn salt(&self) -> &[u8; SALT_LENGTH_BYTES] {
        &self.salt
    }

    /// Seals the secret under a new random nonce.
    pub fn seal_secret(
        &self,
        secret_value: &str,
        random_source: &dyn RandomSource,
    ) -> Result<EncryptedSecret, SetupSecretError> {
        let mut nonce_bytes = [0_u8; NONCE_LEN];
        fill_random_bytes(&mut nonce_bytes, random_source);
        let mut sealed_secret = secret_value.as_bytes().to_vec();
        self.sealing_key
            .seal_in_place_append_tag(
                Nonce::assume_unique_for_key(nonce_bytes),
                Aad::empty(),
                &mut sealed_secret,
            )
            .map_err(|_| SetupSecretError::CipherUnavailable)?;
        let mut sealed_bytes = nonce_bytes.to_vec();
        sealed_bytes.append(&mut sealed_secret);
        Ok(EncryptedSecret {
            salt: self.salt,
            sealed_bytes,
        })
    }

    /// The secret in plain text; a wrong passphrase or a changed file fails the GCM tag.
    pub fn open_secret(
        &self,
        encrypted_secret: &EncryptedSecret,
    ) -> Result<String, SetupSecretError> {
        let (nonce_bytes, sealed_secret) = encrypted_secret.sealed_bytes.split_at(NONCE_LEN);
        let nonce = Nonce::try_assume_unique_for_key(nonce_bytes)
            .map_err(|_| SetupSecretError::WrongPassphrase)?;
        let mut opened_bytes = sealed_secret.to_vec();
        let secret_bytes = self
            .sealing_key
            .open_in_place(nonce, Aad::empty(), &mut opened_bytes)
            .map_err(|_| SetupSecretError::WrongPassphrase)?;
        String::from_utf8(secret_bytes.to_vec()).map_err(|_| SetupSecretError::WrongPassphrase)
    }
}

fn fill_random_bytes(random_bytes: &mut [u8], random_source: &dyn RandomSource) {
    for byte_chunk in random_bytes.chunks_mut(8) {
        let random_word = random_source.next_u64().to_le_bytes();
        byte_chunk.copy_from_slice(&random_word[..byte_chunk.len()]);
    }
}

#[cfg(test)]
mod tests {
    use sendmock_core::SeededRandomSource;

    use super::*;

    const PASSPHRASE: &str = "correct horse battery";

    fn generate_key() -> SetupSecretKey {
        SetupSecretKey::generate(PASSPHRASE, &SeededRandomSource::new(7))
            .unwrap_or_else(|error| panic!("a key: {error}"))
    }

    // AC: PL-18.6
    #[test]
    fn a_sealed_secret_opens_with_the_same_passphrase_and_salt() {
        let secret_key = generate_key();
        let encrypted_secret = secret_key
            .seal_secret(
                "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
                &SeededRandomSource::new(9),
            )
            .unwrap_or_else(|error| panic!("sealed: {error}"));

        let encrypted_text = encrypted_secret.to_text();
        let parsed_secret = EncryptedSecret::parse(&encrypted_text)
            .unwrap_or_else(|error| panic!("parsed: {error}"));
        let reopening_key = SetupSecretKey::derive(PASSPHRASE, *parsed_secret.salt())
            .unwrap_or_else(|error| panic!("a key: {error}"));

        assert!(encrypted_text.starts_with(ENCRYPTED_SECRET_PREFIX));
        assert!(!encrypted_text.contains("whsec_"));
        assert_eq!(
            reopening_key.open_secret(&parsed_secret),
            Ok("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw".to_owned())
        );
    }

    // AC: PL-18.6
    #[test]
    fn a_wrong_passphrase_does_not_open_the_secret() {
        let encrypted_secret = generate_key()
            .seal_secret("token-123", &SeededRandomSource::new(9))
            .unwrap_or_else(|error| panic!("sealed: {error}"));
        let wrong_key = SetupSecretKey::derive("not the passphrase", *encrypted_secret.salt())
            .unwrap_or_else(|error| panic!("a key: {error}"));

        assert_eq!(
            wrong_key.open_secret(&encrypted_secret),
            Err(SetupSecretError::WrongPassphrase)
        );
    }

    #[test]
    fn refuses_a_short_passphrase_for_an_export() {
        assert!(matches!(
            SetupSecretKey::generate("short", &SeededRandomSource::new(7)),
            Err(SetupSecretError::PassphraseTooShort)
        ));
    }

    #[test]
    fn rejects_text_that_is_not_an_encrypted_secret() {
        for encrypted_text in [
            "whsec_abc",
            "encrypted:v1:",
            "encrypted:v1:c2FsdA:AAAA",
            "encrypted:v1:not base64:AAAA",
        ] {
            assert!(
                EncryptedSecret::parse(encrypted_text).is_err(),
                "{encrypted_text}"
            );
        }
    }
}
