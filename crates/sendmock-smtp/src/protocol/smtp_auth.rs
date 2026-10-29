use std::collections::HashMap;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use hmac::{Hmac, KeyInit, Mac};
use md5::Md5;

/// How the server treats AUTH: any credentials work, AUTH is not offered, or the users in a
/// `user:password` file (one per line).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub enum SmtpAuthMode {
    #[default]
    AcceptAny,
    Disabled,
    Credentials(HashMap<String, String>),
}

#[derive(Debug, thiserror::Error)]
pub enum SmtpAuthModeError {
    #[error("--smtp-auth must be accept-any, none or file:<path>, not {0}")]
    UnknownMode(String),

    #[error("Could not read the SMTP credentials file {file_path}: {reason}")]
    UnreadableFile { file_path: String, reason: String },
}

impl SmtpAuthMode {
    pub fn from_setting(setting: &str) -> Result<Self, SmtpAuthModeError> {
        match setting {
            "accept-any" => Ok(Self::AcceptAny),
            "none" => Ok(Self::Disabled),
            _ => match setting.strip_prefix("file:") {
                Some(file_path) => Self::read_credentials_file(file_path),
                None => Err(SmtpAuthModeError::UnknownMode(setting.to_owned())),
            },
        }
    }

    fn read_credentials_file(file_path: &str) -> Result<Self, SmtpAuthModeError> {
        let file_text = std::fs::read_to_string(file_path).map_err(|read_error| {
            SmtpAuthModeError::UnreadableFile {
                file_path: file_path.to_owned(),
                reason: read_error.to_string(),
            }
        })?;
        let credentials = file_text
            .lines()
            .filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with('#'))
            .filter_map(|line| line.split_once(':'))
            .map(|(username, password)| (username.trim().to_owned(), password.trim().to_owned()))
            .collect();
        Ok(Self::Credentials(credentials))
    }

    pub fn is_offered(&self) -> bool {
        !matches!(self, Self::Disabled)
    }

    pub fn accepts_password(&self, username: &str, password: &str) -> bool {
        match self {
            Self::AcceptAny => true,
            Self::Disabled => false,
            Self::Credentials(credentials) => credentials
                .get(username)
                .is_some_and(|stored_password| stored_password == password),
        }
    }

    /// CRAM-MD5 sends `user hex(HMAC-MD5(password, challenge))`, so the password never travels.
    pub fn accepts_cram_md5(&self, username: &str, challenge: &str, digest_hex: &str) -> bool {
        match self {
            Self::AcceptAny => true,
            Self::Disabled => false,
            Self::Credentials(credentials) => credentials.get(username).is_some_and(|password| {
                cram_md5_digest(password, challenge) == digest_hex.to_lowercase()
            }),
        }
    }
}

pub fn cram_md5_digest(password: &str, challenge: &str) -> String {
    let Ok(mut mac) = <Hmac<Md5> as KeyInit>::new_from_slice(password.as_bytes()) else {
        return String::new();
    };
    mac.update(challenge.as_bytes());
    mac.finalize()
        .into_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// `\0user\0password` (with an optional authorisation identity first), base64 encoded.
pub fn decode_plain_response(encoded_response: &str) -> Option<(String, String)> {
    let decoded = BASE64.decode(encoded_response.trim()).ok()?;
    let mut fields = decoded
        .split(|byte| *byte == 0)
        .map(|field| String::from_utf8_lossy(field).into_owned());
    let _authorisation_identity = fields.next()?;
    Some((fields.next()?, fields.next()?))
}

pub fn decode_base64_text(encoded_text: &str) -> Option<String> {
    BASE64
        .decode(encoded_text.trim())
        .ok()
        .map(|decoded| String::from_utf8_lossy(&decoded).into_owned())
}

pub fn encode_base64_text(text: &str) -> String {
    BASE64.encode(text.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn credentials_mode() -> SmtpAuthMode {
        SmtpAuthMode::Credentials(HashMap::from([("app".to_owned(), "secret".to_owned())]))
    }

    #[test]
    fn reads_the_three_settings() {
        assert_eq!(
            SmtpAuthMode::from_setting("accept-any").ok(),
            Some(SmtpAuthMode::AcceptAny)
        );
        assert_eq!(
            SmtpAuthMode::from_setting("none").ok(),
            Some(SmtpAuthMode::Disabled)
        );
        assert!(SmtpAuthMode::from_setting("maybe").is_err());
    }

    #[test]
    fn checks_passwords_against_the_credentials_file() {
        assert!(credentials_mode().accepts_password("app", "secret"));
        assert!(!credentials_mode().accepts_password("app", "wrong"));
        assert!(SmtpAuthMode::AcceptAny.accepts_password("anyone", "anything"));
    }

    #[test]
    fn checks_cram_md5_with_the_rfc_2195_example() {
        let challenge = "<1896.697170952@postoffice.reston.mci.net>";

        assert_eq!(
            cram_md5_digest("tanstaaftanstaaf", challenge),
            "b913a602c7eda7a495b4e6e7334d3890"
        );
        assert!(credentials_mode().accepts_cram_md5(
            "app",
            challenge,
            &cram_md5_digest("secret", challenge)
        ));
    }

    #[test]
    fn decodes_a_plain_response() {
        assert_eq!(
            decode_plain_response(&encode_base64_text("\0app\0secret")),
            Some(("app".to_owned(), "secret".to_owned()))
        );
    }
}
