use std::io;
use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("Database error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error(
        "The database was written by a newer SendMock (schema version {found_version}, this version knows up to {supported_version}). Upgrade SendMock or start with another --db."
    )]
    NewerSchema {
        found_version: u32,
        supported_version: u32,
    },

    #[error("Could not create the database folder {}: {source}", folder_path.display())]
    CreateFolder {
        folder_path: PathBuf,
        source: io::Error,
    },

    #[error("The database writer has stopped")]
    WriterStopped,

    #[error("A database read could not finish: {0}")]
    ReadInterrupted(String),
}
