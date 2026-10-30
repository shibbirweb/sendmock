use std::collections::HashMap;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;

/// Who may use the UI, the API, the realtime streams and MCP over HTTP: users with a
/// password (HTTP basic auth, which the browser asks for) and, optionally, an API token
/// (`Authorization: Bearer`) for the CLI, scripts and the docs playground.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UiAuth {
    passwords_by_user: HashMap<String, String>,
    api_token: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum UiAuthError {
    #[error("--ui-auth must be user:password or file:<path>, not {0}")]
    InvalidSetting(String),

    #[error("Could not read the UI auth file {file_path}: {reason}")]
    UnreadableFile { file_path: String, reason: String },

    #[error("The UI auth file {0} has no user:password line")]
    NoUsers(String),
}

impl UiAuth {
    /// `user:password`, or `file:<path>` with one `user:password` per line (`#` comments).
    pub fn from_setting(setting: &str, api_token: Option<String>) -> Result<Self, UiAuthError> {
        let passwords_by_user = match setting.strip_prefix("file:") {
            Some(file_path) => read_credentials_file(file_path)?,
            None => {
                let (user_name, password) = setting
                    .split_once(':')
                    .filter(|(user_name, password)| !user_name.is_empty() && !password.is_empty())
                    .ok_or_else(|| UiAuthError::InvalidSetting(setting.to_owned()))?;
                HashMap::from([(user_name.to_owned(), password.to_owned())])
            }
        };
        Ok(Self {
            passwords_by_user,
            api_token: api_token.filter(|token| !token.is_empty()),
        })
    }

    /// True for a matching `Basic` user and password or `Bearer` token.
    pub fn accepts_authorization(&self, authorization_header: &str) -> bool {
        if let Some(presented_token) = authorization_header.strip_prefix("Bearer ") {
            return self.api_token.as_deref().is_some_and(|api_token| {
                is_equal_in_constant_time(api_token, presented_token.trim())
            });
        }
        let Some(encoded_credentials) = authorization_header.strip_prefix("Basic ") else {
            return false;
        };
        let Some(decoded_credentials) = BASE64
            .decode(encoded_credentials.trim())
            .ok()
            .and_then(|credential_bytes| String::from_utf8(credential_bytes).ok())
        else {
            return false;
        };
        let Some((user_name, password)) = decoded_credentials.split_once(':') else {
            return false;
        };
        self.passwords_by_user
            .get(user_name)
            .is_some_and(|expected_password| is_equal_in_constant_time(expected_password, password))
    }
}

fn read_credentials_file(file_path: &str) -> Result<HashMap<String, String>, UiAuthError> {
    let file_text =
        std::fs::read_to_string(file_path).map_err(|read_error| UiAuthError::UnreadableFile {
            file_path: file_path.to_owned(),
            reason: read_error.to_string(),
        })?;
    let passwords_by_user: HashMap<String, String> = file_text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .filter_map(|line| line.split_once(':'))
        .map(|(user_name, password)| (user_name.trim().to_owned(), password.trim().to_owned()))
        .collect();
    if passwords_by_user.is_empty() {
        return Err(UiAuthError::NoUsers(file_path.to_owned()));
    }
    Ok(passwords_by_user)
}

/// Compares every byte whatever the first difference, so timing reveals nothing.
fn is_equal_in_constant_time(expected: &str, presented: &str) -> bool {
    let (expected_bytes, presented_bytes) = (expected.as_bytes(), presented.as_bytes());
    let mut difference = expected_bytes.len() ^ presented_bytes.len();
    for (byte_index, expected_byte) in expected_bytes.iter().enumerate() {
        let presented_byte = presented_bytes.get(byte_index).copied().unwrap_or_default();
        difference |= usize::from(expected_byte ^ presented_byte);
    }
    difference == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn basic(credentials: &str) -> String {
        format!("Basic {}", BASE64.encode(credentials))
    }

    #[test]
    fn accepts_the_user_or_the_token_and_nothing_else() -> Result<(), UiAuthError> {
        let ui_auth = UiAuth::from_setting("admin:s3cret", Some("tok_123".to_owned()))?;

        assert!(ui_auth.accepts_authorization(&basic("admin:s3cret")));
        assert!(ui_auth.accepts_authorization("Bearer tok_123"));
        assert!(!ui_auth.accepts_authorization(&basic("admin:wrong")));
        assert!(!ui_auth.accepts_authorization(&basic("someone:s3cret")));
        assert!(!ui_auth.accepts_authorization("Bearer tok_12"));
        assert!(!ui_auth.accepts_authorization("Digest admin"));
        Ok(())
    }

    #[test]
    fn without_a_token_bearer_is_refused() -> Result<(), UiAuthError> {
        let ui_auth = UiAuth::from_setting("admin:s3cret", None)?;

        assert!(!ui_auth.accepts_authorization("Bearer "));
        Ok(())
    }

    #[test]
    fn reads_users_from_a_file() -> Result<(), Box<dyn std::error::Error>> {
        let users_file = tempfile::NamedTempFile::new()?;
        std::fs::write(users_file.path(), "# team\nana:one\nben:two\n")?;

        let ui_auth = UiAuth::from_setting(&format!("file:{}", users_file.path().display()), None)?;

        assert!(ui_auth.accepts_authorization(&basic("ben:two")));
        Ok(())
    }

    #[test]
    fn a_setting_without_a_password_is_refused() {
        assert!(UiAuth::from_setting("admin", None).is_err());
        assert!(UiAuth::from_setting("admin:", None).is_err());
    }
}
