use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use rusqlite::{Connection, OpenFlags};

use crate::{DatabaseLocation, StoreError};

pub(crate) const BUSY_TIMEOUT: Duration = Duration::from_millis(5000);

/// SQLite gives each plain `:memory:` connection its own empty database, so every
/// connection of one in-memory store opens the same named shared-cache database instead.
pub fn connection_target(location: &DatabaseLocation) -> String {
    static NEXT_IN_MEMORY_DATABASE_NUMBER: AtomicU64 = AtomicU64::new(1);
    match location {
        DatabaseLocation::File(file_path) => file_path.display().to_string(),
        DatabaseLocation::InMemory => format!(
            "file:sendmock-{}-{}?mode=memory&cache=shared",
            std::process::id(),
            NEXT_IN_MEMORY_DATABASE_NUMBER.fetch_add(1, Ordering::Relaxed)
        ),
    }
}

/// What the write-ahead log is trimmed to after a checkpoint.
const WAL_SIZE_LIMIT_BYTES: i64 = 4 * 1024 * 1024;

pub fn open_write_connection(
    connection_target: &str,
    location: &DatabaseLocation,
) -> Result<Connection, StoreError> {
    if let DatabaseLocation::File(file_path) = location {
        create_parent_folder(file_path)?;
    }
    let connection = Connection::open_with_flags(
        connection_target,
        OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_URI,
    )?;
    connection.busy_timeout(BUSY_TIMEOUT)?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    // auto_vacuum only takes effect when set before the first table is created.
    connection.pragma_update(None, "auto_vacuum", "INCREMENTAL")?;
    if matches!(location, DatabaseLocation::File(_)) {
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "synchronous", "NORMAL")?;
        // SQLite reuses the write-ahead log but keeps it at its largest size; this trims it
        // back after each checkpoint, so a burst of mail does not leave a large file behind.
        connection.pragma_update(None, "journal_size_limit", WAL_SIZE_LIMIT_BYTES)?;
    }
    Ok(connection)
}

pub fn open_read_connection(connection_target: &str) -> Result<Connection, StoreError> {
    let connection = Connection::open_with_flags(
        connection_target,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI,
    )?;
    connection.busy_timeout(BUSY_TIMEOUT)?;
    // In the shared cache of the in-memory store, readers take table locks that make the
    // writer fail with SQLITE_LOCKED, which no busy timeout retries; read-uncommitted
    // readers take none. Files use WAL, where this pragma has no effect.
    connection.pragma_update(None, "read_uncommitted", true)?;
    Ok(connection)
}

fn create_parent_folder(file_path: &Path) -> Result<(), StoreError> {
    match file_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        Some(folder_path) => {
            std::fs::create_dir_all(folder_path).map_err(|source| StoreError::CreateFolder {
                folder_path: folder_path.to_path_buf(),
                source,
            })
        }
        None => Ok(()),
    }
}
