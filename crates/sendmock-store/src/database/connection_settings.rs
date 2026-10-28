use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use rusqlite::{Connection, OpenFlags};

use crate::{DatabaseLocation, StoreError};

const BUSY_TIMEOUT_MS: u32 = 5000;

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
    connection.busy_timeout(std::time::Duration::from_millis(u64::from(BUSY_TIMEOUT_MS)))?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    // auto_vacuum only takes effect when set before the first table is created.
    connection.pragma_update(None, "auto_vacuum", "INCREMENTAL")?;
    if matches!(location, DatabaseLocation::File(_)) {
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "synchronous", "NORMAL")?;
    }
    Ok(connection)
}

pub fn open_read_connection(connection_target: &str) -> Result<Connection, StoreError> {
    let connection = Connection::open_with_flags(
        connection_target,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI,
    )?;
    connection.busy_timeout(std::time::Duration::from_millis(u64::from(BUSY_TIMEOUT_MS)))?;
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
