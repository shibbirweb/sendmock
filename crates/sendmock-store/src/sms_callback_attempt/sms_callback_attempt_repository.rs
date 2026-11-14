use std::sync::Arc;

use rusqlite::{Connection, Row, params};

use super::{CallbackAttemptResult, SmsCallbackAttemptRecord};
use crate::{Database, StoreError};

const ATTEMPT_COLUMNS: &str = "id, sms_id, reported_status, attempt, status, request, response, duration_ms, error_message, next_attempt_at, created_at";

/// Rows that are due: a `pending` send or a `failed` attempt's retry.
const DUE_CONDITION: &str =
    "status IN ('pending', 'failed') AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?1";

/// Status callback attempts; the rows double as the persistent retry queue.
#[derive(Clone)]
pub struct SmsCallbackAttemptRepository {
    database: Arc<Database>,
}

fn to_stored_duration(duration_ms: Option<u64>) -> Option<i64> {
    duration_ms.map(|duration_ms| i64::try_from(duration_ms).unwrap_or(i64::MAX))
}

fn read_attempt_row(row: &Row<'_>) -> rusqlite::Result<SmsCallbackAttemptRecord> {
    let duration_ms: Option<i64> = row.get(7)?;
    Ok(SmsCallbackAttemptRecord {
        attempt_id: row.get(0)?,
        sms_id: row.get(1)?,
        reported_status: row.get(2)?,
        attempt: row.get(3)?,
        status: row.get(4)?,
        request_json: row.get(5)?,
        response_json: row.get(6)?,
        duration_ms: duration_ms.map(|duration_ms| u64::try_from(duration_ms).unwrap_or_default()),
        error_message: row.get(8)?,
        next_attempt_at_unix_ms: row.get(9)?,
        created_at_unix_ms: row.get(10)?,
    })
}

fn insert_attempt_row(
    connection: &Connection,
    callback_attempt: &SmsCallbackAttemptRecord,
) -> rusqlite::Result<()> {
    connection.execute(
        &format!("INSERT INTO sms_callback_attempts ({ATTEMPT_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"),
        params![
            callback_attempt.attempt_id,
            callback_attempt.sms_id,
            callback_attempt.reported_status,
            callback_attempt.attempt,
            callback_attempt.status,
            callback_attempt.request_json,
            callback_attempt.response_json,
            to_stored_duration(callback_attempt.duration_ms),
            callback_attempt.error_message,
            callback_attempt.next_attempt_at_unix_ms,
            callback_attempt.created_at_unix_ms,
        ],
    )?;
    Ok(())
}

impl SmsCallbackAttemptRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn insert_attempt(
        &self,
        callback_attempt: SmsCallbackAttemptRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| Ok(insert_attempt_row(connection, &callback_attempt)?))
            .await
    }

    /// The attempts that were sent, oldest first; queued and in-flight ones are left out.
    pub async fn list_sent_attempts(
        &self,
        sms_id: &str,
    ) -> Result<Vec<SmsCallbackAttemptRecord>, StoreError> {
        let sms_id = sms_id.to_owned();
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {ATTEMPT_COLUMNS} FROM sms_callback_attempts \
                     WHERE sms_id = ?1 AND status NOT IN ('pending', 'in_flight') ORDER BY created_at, id"
                ))?;
                let attempts = statement
                    .query_map([sms_id], read_attempt_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(attempts)
            })
            .await
    }

    /// Rows due at `now_unix_ms`, the longest waiting first, then in the order they were queued.
    pub async fn list_due_attempts(
        &self,
        now_unix_ms: i64,
        limit: u32,
    ) -> Result<Vec<SmsCallbackAttemptRecord>, StoreError> {
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {ATTEMPT_COLUMNS} FROM sms_callback_attempts WHERE {DUE_CONDITION} ORDER BY next_attempt_at, rowid LIMIT ?2"
                ))?;
                let due_attempts = statement
                    .query_map(params![now_unix_ms, limit], read_attempt_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(due_attempts)
            })
            .await
    }

    /// When the next row comes due; none when nothing waits.
    pub async fn find_next_due_time(&self) -> Result<Option<i64>, StoreError> {
        self.database
            .read(|connection| {
                Ok(connection.query_row(
                    "SELECT min(next_attempt_at) FROM sms_callback_attempts WHERE status IN ('pending', 'failed')",
                    [],
                    |row| row.get(0),
                )?)
            })
            .await
    }

    /// Claims a `pending` row for sending; false when another pass claimed it first.
    pub async fn start_pending_attempt(&self, attempt_id: &str) -> Result<bool, StoreError> {
        let attempt_id = attempt_id.to_owned();
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE sms_callback_attempts SET status = 'in_flight', next_attempt_at = NULL WHERE id = ?1 AND status = 'pending'",
                    [attempt_id],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    /// Claims a `failed` row's retry and inserts the next attempt's row, already `in_flight`;
    /// false when another pass claimed the retry first.
    pub async fn start_retry_attempt(
        &self,
        failed_attempt_id: &str,
        retry_attempt: SmsCallbackAttemptRecord,
    ) -> Result<bool, StoreError> {
        let failed_attempt_id = failed_attempt_id.to_owned();
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let claimed_count = transaction.execute(
                    "UPDATE sms_callback_attempts SET next_attempt_at = NULL WHERE id = ?1 AND status = 'failed' AND next_attempt_at IS NOT NULL",
                    [failed_attempt_id],
                )?;
                if claimed_count > 0 {
                    insert_attempt_row(&transaction, &retry_attempt)?;
                }
                transaction.commit()?;
                Ok(claimed_count > 0)
            })
            .await
    }

    /// Records how an `in_flight` attempt ended; false when the row is not in flight.
    pub async fn finish_attempt(
        &self,
        attempt_id: &str,
        attempt_result: CallbackAttemptResult,
    ) -> Result<bool, StoreError> {
        let attempt_id = attempt_id.to_owned();
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE sms_callback_attempts SET status = ?2, response = ?3, duration_ms = ?4, error_message = ?5, next_attempt_at = ?6 WHERE id = ?1 AND status = 'in_flight'",
                    params![
                        attempt_id,
                        attempt_result.status,
                        attempt_result.response_json,
                        to_stored_duration(attempt_result.duration_ms),
                        attempt_result.error_message,
                        attempt_result.next_attempt_at_unix_ms,
                    ],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    /// Puts rows a stopped process left `in_flight` back in the queue, due at `now_unix_ms`.
    pub async fn requeue_in_flight(&self, now_unix_ms: i64) -> Result<usize, StoreError> {
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "UPDATE sms_callback_attempts SET status = 'pending', next_attempt_at = ?1 WHERE status = 'in_flight'",
                    [now_unix_ms],
                )?)
            })
            .await
    }
}
