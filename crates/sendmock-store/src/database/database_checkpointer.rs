use std::sync::{Arc, Mutex, PoisonError, Weak};
use std::time::{Duration, Instant};

use rusqlite::Connection;

use super::{BUSY_TIMEOUT, SLOW_DATABASE_WORK, duration_ms};
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
/// About 4 MiB of 4 KiB pages: a longer log is cut back once it has been copied.
const LOG_FRAMES_BEFORE_TRUNCATE: i64 = 1024;

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

/// One checkpoint while the database is open; answers whether it still is. A busy or failed
/// checkpoint is left for the next one.
fn checkpoint_while_open(open_connection: &Weak<Mutex<Connection>>) -> bool {
    let Some(connection) = open_connection.upgrade() else {
        return false;
    };
    let connection = connection.lock().unwrap_or_else(PoisonError::into_inner);
    let checkpoint_started_at = Instant::now();
    let checkpoint_progress = connection.query_row("PRAGMA wal_checkpoint(PASSIVE)", [], |row| {
        Ok(CheckpointProgress {
            log_frame_count: row.get(1)?,
            checkpointed_frame_count: row.get(2)?,
        })
    });
    if let Ok(checkpoint_progress) = checkpoint_progress {
        let is_whole_log_copied =
            checkpoint_progress.checkpointed_frame_count == checkpoint_progress.log_frame_count;
        if is_whole_log_copied && checkpoint_progress.log_frame_count >= LOG_FRAMES_BEFORE_TRUNCATE
        {
            let _ = truncate_copied_log(&connection);
        }
    }
    let checkpoint_duration = checkpoint_started_at.elapsed();
    if checkpoint_duration > SLOW_DATABASE_WORK {
        tracing::warn!(
            checkpoint_ms = duration_ms(checkpoint_duration),
            "a write-ahead log checkpoint was slow"
        );
    }
    true
}

/// Beside steady writes a passive checkpoint seldom copies the whole log, so the writer never
/// starts it over and it keeps growing. Once a passive pass has copied all of it, a truncating
/// checkpoint has nothing to copy or sync and only cuts the file, so it holds writers for a
/// moment; it is tried without waiting, and skipped while a write or an older read is in the
/// way. It is never tried with frames left, since copying and syncing them under the write
/// lock made SMTP writes time out on a slow disk.
fn truncate_copied_log(connection: &Connection) -> rusqlite::Result<()> {
    connection.busy_timeout(Duration::ZERO)?;
    let checkpoint_result = connection.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()));
    connection.busy_timeout(BUSY_TIMEOUT)?;
    checkpoint_result
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
    fn a_long_log_is_cut_back_once_it_is_copied() -> Result<(), Box<dyn std::error::Error>> {
        let database_folder = tempfile::tempdir()?;
        let connection = open_wal_database(&database_folder)?;
        connection.execute_batch(
            "WITH RECURSIVE note_numbers(note_number) AS \
             (SELECT 1 UNION ALL SELECT note_number + 1 FROM note_numbers WHERE note_number < 6000) \
             INSERT INTO notes SELECT hex(randomblob(1000)) FROM note_numbers;",
        )?;
        let log_path = database_folder.path().join("sendmock.db-wal");
        let log_size_before = std::fs::metadata(&log_path)?.len();
        let shared_connection = Arc::new(Mutex::new(connection));

        checkpoint_while_open(&Arc::downgrade(&shared_connection));

        assert!(log_size_before > 4 * 1024 * 1024, "{log_size_before}");
        assert_eq!(std::fs::metadata(&log_path)?.len(), 0);
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
