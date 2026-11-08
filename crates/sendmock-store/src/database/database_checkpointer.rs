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
/// About 4 MiB of 4 KiB pages: a longer log is cut back once writes pause.
const LOG_FRAMES_BEFORE_TRUNCATE: i64 = 1024;
/// About 256 MiB: a log this long is cut back even while writes keep coming, so a flood that
/// never pauses cannot fill the disk.
const LOG_FRAMES_LIMIT_UNDER_LOAD: i64 = 65_536;

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
                let mut previous_log_frame_count = None;
                std::thread::sleep(BACKGROUND_CHECKPOINT_INTERVAL);
                while checkpoint_while_open(&open_connection, &mut previous_log_frame_count) {
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

/// One checkpoint pass while the database is open; answers whether it still is. A busy or
/// failed checkpoint is left for the next pass. `previous_log_frame_count` is the log's length
/// after the last pass, which tells whether writes have paused since.
fn checkpoint_while_open(
    open_connection: &Weak<Mutex<Connection>>,
    previous_log_frame_count: &mut Option<i64>,
) -> bool {
    let Some(connection) = open_connection.upgrade() else {
        return false;
    };
    let connection = connection.lock().unwrap_or_else(PoisonError::into_inner);
    let passive_started_at = Instant::now();
    let checkpoint_progress = connection.query_row("PRAGMA wal_checkpoint(PASSIVE)", [], |row| {
        Ok(CheckpointProgress {
            log_frame_count: row.get(1)?,
            checkpointed_frame_count: row.get(2)?,
        })
    });
    let passive_duration = passive_started_at.elapsed();
    let mut truncate_duration = Duration::ZERO;
    if let Ok(checkpoint_progress) = checkpoint_progress {
        if should_truncate(checkpoint_progress, *previous_log_frame_count) {
            let truncate_started_at = Instant::now();
            let _ = truncate_copied_log(&connection);
            truncate_duration = truncate_started_at.elapsed();
        }
        *previous_log_frame_count = Some(checkpoint_progress.log_frame_count);
    }
    if passive_duration + truncate_duration > SLOW_DATABASE_WORK {
        tracing::warn!(
            passive_ms = duration_ms(passive_duration),
            truncate_ms = duration_ms(truncate_duration),
            "a write-ahead log checkpoint was slow"
        );
    }
    true
}

/// A truncating checkpoint takes SQLite's write lock and copies and syncs whatever was written
/// since the passive pass before it cuts the file; on a slow disk that held SMTP writes for
/// seconds. A passive pass reports the whole log copied even under steady writes, so the log
/// is only cut once writes have paused (it did not grow since the last pass), or when it has
/// grown past the limit under a flood that never pauses.
fn should_truncate(
    checkpoint_progress: CheckpointProgress,
    previous_log_frame_count: Option<i64>,
) -> bool {
    let log_frame_count = checkpoint_progress.log_frame_count;
    let is_whole_log_copied = checkpoint_progress.checkpointed_frame_count == log_frame_count;
    let have_writes_paused = previous_log_frame_count == Some(log_frame_count);
    is_whole_log_copied
        && (log_frame_count >= LOG_FRAMES_LIMIT_UNDER_LOAD
            || (have_writes_paused && log_frame_count >= LOG_FRAMES_BEFORE_TRUNCATE))
}

/// Tried without waiting, and skipped while a write or an older read is in the way.
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

        let is_still_open = checkpoint_while_open(&Arc::downgrade(&shared_connection), &mut None);

        let connection = shared_connection
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        assert!(is_still_open);
        assert_eq!(uncopied_frame_count(&connection)?, 0);
        Ok(())
    }

    #[test]
    fn a_long_log_is_cut_back_once_writes_pause() -> Result<(), Box<dyn std::error::Error>> {
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
        let mut previous_log_frame_count = None;

        checkpoint_while_open(
            &Arc::downgrade(&shared_connection),
            &mut previous_log_frame_count,
        );
        let log_size_after_first_pass = std::fs::metadata(&log_path)?.len();
        checkpoint_while_open(
            &Arc::downgrade(&shared_connection),
            &mut previous_log_frame_count,
        );

        assert!(log_size_before > 4 * 1024 * 1024, "{log_size_before}");
        assert_eq!(log_size_after_first_pass, log_size_before);
        assert_eq!(std::fs::metadata(&log_path)?.len(), 0);
        Ok(())
    }

    #[test]
    fn the_log_is_cut_only_when_copied_and_writes_paused_or_past_the_limit() {
        let copied = |log_frame_count| CheckpointProgress {
            log_frame_count,
            checkpointed_frame_count: log_frame_count,
        };
        let partly_copied = CheckpointProgress {
            log_frame_count: 5000,
            checkpointed_frame_count: 4000,
        };

        assert!(should_truncate(copied(5000), Some(5000)));
        assert!(!should_truncate(copied(5000), Some(4000)));
        assert!(!should_truncate(copied(5000), None));
        assert!(!should_truncate(copied(500), Some(500)));
        assert!(!should_truncate(partly_copied, Some(5000)));
        assert!(should_truncate(
            copied(LOG_FRAMES_LIMIT_UNDER_LOAD),
            Some(1000)
        ));
    }

    #[test]
    fn background_checkpoints_stop_once_the_database_is_closed()
    -> Result<(), Box<dyn std::error::Error>> {
        let database_folder = tempfile::tempdir()?;
        let shared_connection = Arc::new(Mutex::new(open_wal_database(&database_folder)?));
        let open_connection = Arc::downgrade(&shared_connection);

        drop(shared_connection);

        assert!(!checkpoint_while_open(&open_connection, &mut None));
        Ok(())
    }
}
