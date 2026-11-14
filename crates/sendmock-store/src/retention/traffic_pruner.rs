use std::sync::Arc;

use rusqlite::params;

use super::prunable_table::PrunableTable;
use crate::{Database, StoreError};

/// Rows deleted per write; small enough that a waiting ingest write is never held long.
const PRUNE_BATCH_SIZE: i64 = 500;
/// Pages handed back to the file system per write, for the same reason.
const VACUUM_PAGES_PER_WRITE: i64 = 250;

/// Child rows whose tables have no cascading key, removed once their parent is gone.
const ORPHAN_CLEANUP_STATEMENTS: [&str; 2] = [
    "DELETE FROM email_responses WHERE email_id NOT IN (SELECT id FROM emails)",
    "DELETE FROM http_captured_files WHERE request_id NOT IN (SELECT id FROM http_captured_requests)",
];

/// Trims traffic tables in small batches, each its own write, so SMTP and API ingest keep
/// going while it runs.
#[derive(Clone)]
pub struct TrafficPruner {
    database: Arc<Database>,
}

impl TrafficPruner {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Deletes the table's prunable rows dated before the cutoff and those past the newest
    /// `max_count`; answers how many went.
    pub async fn prune(
        &self,
        prunable_table: PrunableTable,
        max_count: Option<u64>,
        before_unix_ms: Option<i64>,
    ) -> Result<u64, StoreError> {
        let mut deleted_count = 0;
        if let Some(before_unix_ms) = before_unix_ms {
            deleted_count += self
                .delete_in_batches(
                    prunable_table.delete_older_batch_statement(),
                    before_unix_ms,
                )
                .await?;
        }
        if let Some(max_count) = max_count {
            let kept_count = i64::try_from(max_count).unwrap_or(i64::MAX);
            deleted_count += self
                .delete_in_batches(
                    prunable_table.delete_beyond_count_batch_statement(),
                    kept_count,
                )
                .await?;
        }
        Ok(deleted_count)
    }

    /// Removes the child rows left behind by pruned emails and HTTP requests.
    pub async fn remove_orphans(&self) -> Result<u64, StoreError> {
        self.database
            .write(|connection| {
                let mut deleted_count = 0;
                for cleanup_statement in ORPHAN_CLEANUP_STATEMENTS {
                    deleted_count += connection.execute(cleanup_statement, [])?;
                }
                Ok(u64::try_from(deleted_count).unwrap_or_default())
            })
            .await
    }

    /// Gives the pages pruning freed back to the file system, so the files on disk stay the same
    /// size under continuous traffic instead of keeping their largest size.
    pub async fn reclaim_free_pages(&self) -> Result<(), StoreError> {
        // A database made without incremental auto-vacuum keeps its free pages; stop when
        // the count no longer falls rather than loop forever.
        let mut previous_free_pages = i64::MAX;
        loop {
            let remaining_free_pages = self
                .database
                .write(|connection| {
                    connection.execute_batch(&format!(
                        "PRAGMA incremental_vacuum({VACUUM_PAGES_PER_WRITE});"
                    ))?;
                    Ok(connection
                        .query_row("PRAGMA freelist_count", [], |row| row.get::<_, i64>(0))?)
                })
                .await?;
            if remaining_free_pages == 0 || remaining_free_pages >= previous_free_pages {
                return self.copy_write_ahead_log().await;
            }
            previous_free_pages = remaining_free_pages;
        }
    }

    /// Copies the write-ahead log into the database file beside ingest; a copy of the whole log
    /// also cuts the database file down to what the vacuum left. The log itself is cut back by
    /// the background checkpoints once writes pause: cutting it here, in the writer's queue,
    /// copied and synced the frames written since and held SMTP writes for seconds on Windows.
    async fn copy_write_ahead_log(&self) -> Result<(), StoreError> {
        self.database.checkpoint_without_blocking_writes().await?;
        Ok(())
    }

    async fn delete_in_batches(
        &self,
        delete_statement: String,
        bound_value: i64,
    ) -> Result<u64, StoreError> {
        let delete_statement: Arc<str> = Arc::from(delete_statement);
        let mut deleted_count = 0_u64;
        loop {
            let batch_statement = Arc::clone(&delete_statement);
            let batch_deleted = self
                .database
                .write(move |connection| {
                    Ok(connection
                        .execute(&batch_statement, params![bound_value, PRUNE_BATCH_SIZE])?)
                })
                .await?;
            deleted_count += u64::try_from(batch_deleted).unwrap_or_default();
            if i64::try_from(batch_deleted).unwrap_or_default() < PRUNE_BATCH_SIZE {
                return Ok(deleted_count);
            }
        }
    }
}
