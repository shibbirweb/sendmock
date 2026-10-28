use std::process::ExitCode;

/// The exit codes every command uses, as documented for scripts and agents.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum CliExitCode {
    Success = 0,
    Error = 1,
    Usage = 2,
    NotFound = 3,
    Timeout = 4,
    AssertionFailed = 5,
}

impl From<CliExitCode> for ExitCode {
    fn from(cli_exit_code: CliExitCode) -> Self {
        ExitCode::from(cli_exit_code as u8)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CliError {
    #[error(
        "Could not reach SendMock at {server_url}: {reason}. Is it running? Start it with `sendmock`."
    )]
    ServerUnreachable { server_url: String, reason: String },

    #[error("{message}")]
    Api {
        http_status: u16,
        code: String,
        message: String,
    },

    #[error("SendMock answered with something that is not JSON: {0}")]
    UnreadableAnswer(String),
}

impl CliError {
    pub fn exit_code(&self) -> CliExitCode {
        match self {
            Self::ServerUnreachable { .. } | Self::UnreadableAnswer(_) => CliExitCode::Error,
            Self::Api { http_status, .. } => match http_status {
                400 => CliExitCode::Usage,
                404 => CliExitCode::NotFound,
                408 => CliExitCode::Timeout,
                _ => CliExitCode::Error,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn api_error(http_status: u16) -> CliError {
        CliError::Api {
            http_status,
            code: "code".to_owned(),
            message: "message".to_owned(),
        }
    }

    // AC: AI-01.3
    #[test]
    fn maps_each_failure_to_its_documented_exit_code() {
        assert_eq!(api_error(400).exit_code(), CliExitCode::Usage);
        assert_eq!(api_error(404).exit_code(), CliExitCode::NotFound);
        assert_eq!(api_error(408).exit_code(), CliExitCode::Timeout);
        assert_eq!(api_error(500).exit_code(), CliExitCode::Error);
        let unreachable = CliError::ServerUnreachable {
            server_url: "http://127.0.0.1:8025".to_owned(),
            reason: "connection refused".to_owned(),
        };
        assert_eq!(unreachable.exit_code(), CliExitCode::Error);
    }

    // AC: AI-01.3
    #[test]
    fn uses_the_documented_numbers() {
        let exit_codes = [
            CliExitCode::Success,
            CliExitCode::Error,
            CliExitCode::Usage,
            CliExitCode::NotFound,
            CliExitCode::Timeout,
            CliExitCode::AssertionFailed,
        ];

        let numbers: Vec<u8> = exit_codes
            .iter()
            .map(|exit_code| *exit_code as u8)
            .collect();

        assert_eq!(numbers, [0, 1, 2, 3, 4, 5]);
    }
}
