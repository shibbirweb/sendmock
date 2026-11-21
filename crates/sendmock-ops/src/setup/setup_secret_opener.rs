use std::ops::Range;

use super::setup_secret_cipher::{ENCRYPTED_SECRET_PREFIX, EncryptedSecret, SetupSecretKey};
use super::setup_secret_error::SetupSecretError;

/// Where each encrypted secret sits in the text: a whole value, or inside a provider's or
/// gateway's definition JSON, which a setup holds as text.
pub fn find_encrypted_secret_spans(text: &str) -> Vec<Range<usize>> {
    let mut secret_spans = Vec::new();
    let mut search_start = 0;
    while let Some(prefix_offset) = text[search_start..].find(ENCRYPTED_SECRET_PREFIX) {
        let span_start = search_start + prefix_offset;
        let parts_start = span_start + ENCRYPTED_SECRET_PREFIX.len();
        let parts_length = text[parts_start..]
            .find(|character: char| !is_encrypted_secret_character(character))
            .unwrap_or(text.len() - parts_start);
        let span_end = parts_start + parts_length;
        secret_spans.push(span_start..span_end);
        search_start = span_end;
    }
    secret_spans
}

/// The text with every encrypted secret emptied. The seed state keeps a file this way, so
/// reset can apply it again without the passphrase: an empty secret keeps the stored one.
pub fn blank_encrypted_secrets(text: &str) -> String {
    let mut blanked_text = String::with_capacity(text.len());
    let mut copied_until = 0;
    for secret_span in find_encrypted_secret_spans(text) {
        blanked_text.push_str(&text[copied_until..secret_span.start]);
        copied_until = secret_span.end;
    }
    blanked_text.push_str(&text[copied_until..]);
    blanked_text
}

fn is_encrypted_secret_character(character: char) -> bool {
    character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | ':')
}

/// Opens every encrypted secret in a setup with one passphrase, deriving each salt's key once.
pub struct SetupSecretOpener<'passphrase> {
    passphrase: Option<&'passphrase str>,
    derived_keys: Vec<SetupSecretKey>,
}

impl<'passphrase> SetupSecretOpener<'passphrase> {
    pub fn new(passphrase: Option<&'passphrase str>) -> Self {
        Self {
            passphrase: passphrase.filter(|passphrase| !passphrase.is_empty()),
            derived_keys: Vec::new(),
        }
    }

    /// Replaces each encrypted secret in the setup's strings with its plain text; nothing is
    /// changed when one does not open.
    pub fn open_secrets(&mut self, setup_value: &mut toml::Value) -> Result<(), SetupSecretError> {
        let mut opened_value = setup_value.clone();
        self.open_secrets_in_place(&mut opened_value)?;
        *setup_value = opened_value;
        Ok(())
    }

    fn open_secrets_in_place(
        &mut self,
        setup_value: &mut toml::Value,
    ) -> Result<(), SetupSecretError> {
        match setup_value {
            toml::Value::String(text) => {
                if text.contains(ENCRYPTED_SECRET_PREFIX) {
                    *text = self.open_text(text)?;
                }
            }
            toml::Value::Array(items) => {
                for item in items {
                    self.open_secrets_in_place(item)?;
                }
            }
            toml::Value::Table(table) => {
                for (_, table_value) in table.iter_mut() {
                    self.open_secrets_in_place(table_value)?;
                }
            }
            toml::Value::Integer(_)
            | toml::Value::Float(_)
            | toml::Value::Boolean(_)
            | toml::Value::Datetime(_) => {}
        }
        Ok(())
    }

    /// A secret inside a definition's JSON text goes in as a JSON string's contents, so a
    /// quote or backslash in it keeps the definition valid.
    fn open_text(&mut self, text: &str) -> Result<String, SetupSecretError> {
        let secret_spans = find_encrypted_secret_spans(text);
        let is_whole_value = secret_spans
            .first()
            .is_some_and(|secret_span| *secret_span == (0..text.len()));
        let mut opened_text = String::with_capacity(text.len());
        let mut copied_until = 0;
        for secret_span in secret_spans {
            opened_text.push_str(&text[copied_until..secret_span.start]);
            let secret_value = self.open_secret(&text[secret_span.clone()])?;
            if is_whole_value {
                opened_text.push_str(&secret_value);
            } else {
                opened_text.push_str(&escape_json_string_contents(&secret_value));
            }
            copied_until = secret_span.end;
        }
        opened_text.push_str(&text[copied_until..]);
        Ok(opened_text)
    }

    fn open_secret(&mut self, encrypted_text: &str) -> Result<String, SetupSecretError> {
        let encrypted_secret = EncryptedSecret::parse(encrypted_text)?;
        let passphrase = self
            .passphrase
            .ok_or(SetupSecretError::PassphraseRequired)?;
        let known_key_index = self
            .derived_keys
            .iter()
            .position(|derived_key| derived_key.salt() == encrypted_secret.salt());
        let key_index = match known_key_index {
            Some(key_index) => key_index,
            None => {
                self.derived_keys.push(SetupSecretKey::derive(
                    passphrase,
                    *encrypted_secret.salt(),
                )?);
                self.derived_keys.len() - 1
            }
        };
        self.derived_keys
            .get(key_index)
            .ok_or(SetupSecretError::CipherUnavailable)?
            .open_secret(&encrypted_secret)
    }
}

fn escape_json_string_contents(secret_value: &str) -> String {
    let quoted_value = serde_json::Value::from(secret_value).to_string();
    quoted_value
        .strip_prefix('"')
        .and_then(|unquoted| unquoted.strip_suffix('"'))
        .unwrap_or(&quoted_value)
        .to_owned()
}

#[cfg(test)]
mod tests {
    use sendmock_core::SeededRandomSource;

    use super::*;

    const PASSPHRASE: &str = "correct horse battery";

    fn encrypt(secret_value: &str) -> String {
        let random_source = SeededRandomSource::new(3);
        SetupSecretKey::generate(PASSPHRASE, &random_source)
            .and_then(|secret_key| secret_key.seal_secret(secret_value, &random_source))
            .map(|encrypted_secret| encrypted_secret.to_text())
            .unwrap_or_else(|error| panic!("encrypted: {error}"))
    }

    fn parse_setup(setup_toml: &str) -> toml::Value {
        toml::Value::Table(
            setup_toml
                .parse()
                .unwrap_or_else(|error| panic!("a setup: {error}")),
        )
    }

    // AC: PL-18.6
    #[test]
    fn opens_whole_values_and_secrets_inside_definition_json() {
        let endpoint_secret = encrypt("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw");
        let credential_secret = encrypt("sk_\"quoted\"");
        let mut setup_value = parse_setup(&format!(
            "[[webhook.endpoints]]\nsecret = \"{endpoint_secret}\"\n\n[[sms.providers]]\ndefinition = '{{\"credentials\":[{{\"value\":\"{credential_secret}\"}}]}}'\n"
        ));

        SetupSecretOpener::new(Some(PASSPHRASE))
            .open_secrets(&mut setup_value)
            .unwrap_or_else(|error| panic!("opened: {error}"));

        assert_eq!(
            setup_value["webhook"]["endpoints"][0]["secret"].as_str(),
            Some("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw")
        );
        let definition: serde_json::Value = serde_json::from_str(
            setup_value["sms"]["providers"][0]["definition"]
                .as_str()
                .unwrap_or_default(),
        )
        .unwrap_or_else(|error| panic!("valid JSON: {error}"));
        assert_eq!(definition["credentials"][0]["value"], "sk_\"quoted\"");
    }

    // AC: PL-18.6
    #[test]
    fn refuses_without_a_passphrase_or_with_a_wrong_one_and_changes_nothing() {
        let setup_toml = format!(
            "[[webhook.endpoints]]\nsecret = \"{}\"\n",
            encrypt("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw")
        );
        let original_value = parse_setup(&setup_toml);

        for (passphrase, expected_error) in [
            (None, SetupSecretError::PassphraseRequired),
            (Some(""), SetupSecretError::PassphraseRequired),
            (
                Some("not the passphrase"),
                SetupSecretError::WrongPassphrase,
            ),
        ] {
            let mut setup_value = original_value.clone();

            let open_result = SetupSecretOpener::new(passphrase).open_secrets(&mut setup_value);

            assert_eq!(open_result, Err(expected_error));
            assert_eq!(setup_value, original_value);
        }
    }

    #[test]
    fn blanks_every_encrypted_secret_and_keeps_the_rest() {
        let encrypted_secret = encrypt("token-123");
        let setup_toml = format!(
            "secret = \"{encrypted_secret}\"\ndefinition = '{{\"value\":\"{encrypted_secret}\"}}'\nurl = \"http://localhost\"\n"
        );

        assert_eq!(
            blank_encrypted_secrets(&setup_toml),
            "secret = \"\"\ndefinition = '{\"value\":\"\"}'\nurl = \"http://localhost\"\n"
        );
    }

    #[test]
    fn finds_each_secret_in_a_text() {
        let encrypted_secret = encrypt("token-123");
        let text = format!("{{\"a\":\"{encrypted_secret}\",\"b\":\"{encrypted_secret}\"}}");

        let secret_spans = find_encrypted_secret_spans(&text);

        assert_eq!(secret_spans.len(), 2);
        for secret_span in secret_spans {
            assert_eq!(&text[secret_span], encrypted_secret);
        }
    }
}
