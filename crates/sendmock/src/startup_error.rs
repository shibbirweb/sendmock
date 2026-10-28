use std::io;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::process::ExitCode;

use sendmock_store::StoreError;

use crate::config::ConfigError;

/// The exit code for a configuration or usage mistake, as in the CLI exit code table.
const USAGE_ERROR_EXIT_CODE: u8 = 2;
const ERROR_EXIT_CODE: u8 = 1;

#[derive(Debug, thiserror::Error)]
pub enum StartupError {
    #[error(transparent)]
    Config(#[from] ConfigError),

    #[error(
        "Port {} is in use. Start SendMock with {flag_name} {suggested_addr} or stop the other program.",
        address.port()
    )]
    PortInUse {
        address: SocketAddr,
        flag_name: &'static str,
        suggested_addr: SocketAddr,
    },

    #[error("Could not listen on {address}: {source}")]
    Listen {
        address: SocketAddr,
        source: io::Error,
    },

    #[error(transparent)]
    Database(#[from] StoreError),

    #[error("Could not read the seed file {}: {source}", file_path.display())]
    UnreadableSeed {
        file_path: PathBuf,
        source: io::Error,
    },

    #[error("The seed file {} is not valid:\n{problems}", file_path.display())]
    InvalidSeed {
        file_path: PathBuf,
        problems: String,
    },

    #[error("Could not start the server runtime: {0}")]
    Runtime(io::Error),
}

impl StartupError {
    pub fn exit_code(&self) -> ExitCode {
        match self {
            Self::Config(_) | Self::UnreadableSeed { .. } | Self::InvalidSeed { .. } => {
                ExitCode::from(USAGE_ERROR_EXIT_CODE)
            }
            Self::PortInUse { .. } | Self::Listen { .. } | Self::Database(_) | Self::Runtime(_) => {
                ExitCode::from(ERROR_EXIT_CODE)
            }
        }
    }
}
