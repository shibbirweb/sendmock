use std::collections::HashMap;

/// Who may sign in: anyone (`accept-any`, the default on a developer's machine), or the
/// `user:password` lines of a file, as `--smtp-auth file:<path>` reads them.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub enum Pop3Login {
    #[default]
    AcceptAny,
    Credentials(HashMap<String, String>),
}

#[derive(Debug, thiserror::Error)]
pub enum Pop3LoginError {
    #[error("--pop3-auth must be accept-any or file:<path>, not {0}")]
    UnknownMode(String),

    #[error("Could not read the POP3 credentials file {file_path}: {reason}")]
    UnreadableFile { file_path: String, reason: String },
}

impl Pop3Login {
    pub fn from_setting(setting: &str) -> Result<Self, Pop3LoginError> {
        if setting == "accept-any" {
            return Ok(Self::AcceptAny);
        }
        let Some(file_path) = setting.strip_prefix("file:") else {
            return Err(Pop3LoginError::UnknownMode(setting.to_owned()));
        };
        sendmock_core::read_credentials_file(file_path)
            .map(Self::Credentials)
            .map_err(|read_error| Pop3LoginError::UnreadableFile {
                file_path: file_path.to_owned(),
                reason: read_error.to_string(),
            })
    }

    pub fn accepts_password(&self, username: &str, password: &str) -> bool {
        match self {
            Self::AcceptAny => true,
            Self::Credentials(credentials) => credentials
                .get(username)
                .is_some_and(|stored_password| stored_password == password),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_credentials_file_admits_only_its_logins() {
        let login =
            Pop3Login::Credentials(HashMap::from([("shop".to_owned(), "s3cret".to_owned())]));

        assert!(login.accepts_password("shop", "s3cret"));
        assert!(!login.accepts_password("shop", "wrong"));
        assert!(!login.accepts_password("blog", "s3cret"));
        assert!(Pop3Login::AcceptAny.accepts_password("anyone", "anything"));
    }

    #[test]
    fn an_unknown_setting_is_refused() {
        assert!(Pop3Login::from_setting("none").is_err());
        assert_eq!(
            Pop3Login::from_setting("accept-any").ok(),
            Some(Pop3Login::AcceptAny)
        );
    }
}
