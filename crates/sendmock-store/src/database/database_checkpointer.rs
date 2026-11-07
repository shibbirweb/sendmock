use std::sync::{Arc, Mutex, PoisonError, Weak};
use std::time::Duration;

use rusqlite::Connection;

use crate::StoreError;

/// How far a checkpoint got: frames in the write-ahead log and how many of them are now in
/// the database file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CheckpointProgress {
    pub log_frame_count: i64,
    pub checkpointed_frame_count: i64,
}

/// How often the background thread copies the write-ahead log into the database file.
const BACKGROUND_CHECKPOINT_INTERVAL: Duration = Duration::from_secs(1);

/// A connection of its own for copying the write-ahead log into the database file. A passive
/// checkpoint never takes the write lock, so the copy and its sync run beside ingest instead of
/// in the writer's queue, where a slow disk would hold every write behind them.
pub struct DatabaseCheckpointer {
    connection: Arc<Mutex<Connection>>,
}

impl DatabaseCheckpointer {
    pub fn new(connection: Connection) -> Self {
        Self {
            connection: Arc::new(Mutex::new(connection)),
        }
    }

    /// Copies the log every second on a thread of its own, in place of SQLite's automatic
    /// checkpoint, which runs inside whichever write crosses its threshold: on a slow disk that
    /// write, often an SMTP message, waited seconds for the copy and its sync. The thread stops
    /// once the database is closed.
    pub fn start_background_checkpoints(&self) -> Result<(), StoreError> {
        let open_connection = Arc::downgrade(&self.connection);
        std::thread::Builder::new()
            .name("sendmock-checkpoint".to_owned())
            .spawn(move || {
                std::thread::sleep(BACKGROUND_CHECKPOINT_INTERVAL);
                while checkpoint_while_open(&open_connection) {
                    std::thread::sleep(BACKGROUND_CHECKPOINT_INTERVAL);
                }
            })
            .map(|_| ())
            .map_err(|spawn_error| StoreError::CheckpointInterrupted(spawn_error.to_string()))
    }

    pub async fn checkpoint_passively(&self) -> Result<CheckpointProgress, StoreError> {
        let connection = Arc::clone(&self.connection);
        tokio::task::spawn_blocking(move || {
            let connection = connection.lock().unwrap_or_else(PoisonError::into_inner);
            Ok(
                connection.query_row("PRAGMA wal_checkpoint(PASSIVE)", [], |row| {
                    Ok(CheckpointProgress {
                        log_frame_count: row.get(1)?,
                        checkpointed_frame_count: row.get(2)?,
                    })
                })?,
            )
        })
        .await
        .map_err(|join_error| StoreError::CheckpointInterrupted(join_error.to_string()))?
    }
}

/// One passive checkpoint while the database is open; answers whether it still is. A busy or
/// failed checkpoint is left for the next one.
fn checkpoint_while_open(open_connection: &Weak<Mutex<Connection>>) -> bool {
    let Some(connection) = open_connection.upgrade() else {
        return false;
    };
    let connection = connection.lock().unwrap_or_else(PoisonError::into_inner);
    let _ = connection.query_row("PRAGMA wal_checkpoint(PASSIVE)", [], |_| Ok(()));
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open_wal_database(
        database_folder: &tempfile::TempDir,
    ) -> Result<Connection, rusqlite::Error> {
        let connection = Connection::open(database_folder.path().join("sendmock.db"))?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "wal_autocheckpoint", 0)?;
        connection.execute_batch(
            "CREATE TABLE notes (body TEXT); INSERT INTO notes VALUES ('first'), ('second');",
        )?;
        Ok(connection)
    }

    fn uncopied_frame_count(connection: &Connection) -> Result<i64, rusqlite::Error> {
        connection.query_row("PRAGMA wal_checkpoint(PASSIVE)", [], |row| {
            Ok(row.get::<_, i64>(1)? - row.get::<_, i64>(2)?)
        })
    }

    #[test]
    fn a_background_checkpoint_copies_the_log_while_the_database_is_open()
    -> Result<(), Box<dyn std::error::Error>> {
        let database_folder = tempfile::tempdir()?;
        let shared_connection = Arc::new(Mutex::new(open_wal_database(&database_folder)?));

        let is_still_open = checkpoint_while_open(&Arc::downgrade(&shared_connection));

        let connection = shared_connection
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        assert!(is_still_open);
        assert_eq!(uncopied_frame_count(&connection)?, 0);
        Ok(())
    }

    #[test]
    fn background_checkpoints_stop_once_the_database_is_closed()
    -> Result<(), Box<dyn std::error::Error>> {
        let database_folder = tempfile::tempdir()?;
        let shared_connection = Arc::new(Mutex::new(open_wal_database(&database_folder)?));
        let open_connection = Arc::downgrade(&shared_connection);

        drop(shared_connection);

        assert!(!checkpoint_while_open(&open_connection));
        Ok(())
    }
}
