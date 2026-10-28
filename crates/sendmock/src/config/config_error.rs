use std::io;
use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Could not read the configuration file {}: {source}", file_path.display())]
    UnreadableFile {
        file_path: PathBuf,
        source: io::Error,
    },

    #[error("The configuration file {} is not valid: {reason}", file_path.display())]
    InvalidFile { file_path: PathBuf, reason: String },
}
