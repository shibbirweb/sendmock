use std::sync::{Arc, Mutex, PoisonError};

use rusqlite::Connection;

use crate::StoreError;

/// How far a checkpoint got: frames in the write-ahead log and how many of them are now in
/// the database file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CheckpointProgress {
    pub log_frame_count: i64,
    pub checkpointed_frame_count: i64,
}

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
