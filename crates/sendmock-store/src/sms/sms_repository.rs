use std::collections::HashMap;
use std::sync::Arc;

use rusqlite::{OptionalExtension, params};

use super::sms_reader;
use super::sms_row_mapping::{SMS_COLUMNS, attach_media, insert_sms_row, read_sms_row};
use super::{
    NewSmsRecord, SmsCallbackAttemptRecord, SmsListFilter, SmsPage, SmsRecord,
    SmsStatusChangeRecord, SmsThreadRecord,
};
use crate::{Database, StoreError};

/// A stored media file: its content type, file name and bytes.
pub type SmsMediaContent = (String, Option<String>, Vec<u8>);

/// Every SMS query.
#[derive(Clone)]
pub struct SmsRepository {
    database: Arc<Database>,
}

impl SmsRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub(super) fn database(&self) -> &Database {
        &self.database
    }

    /// Stores the message, its media and its first status in one transaction.
    pub async fn insert_message(&self, new_sms: NewSmsRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                insert_sms_row(&transaction, &new_sms.sms)?;
                for (media, content) in new_sms.sms.media.iter().zip(&new_sms.media_contents) {
                    transaction.execute(
                        "INSERT INTO sms_media (sms_id, media_index, content_type, filename, source_url, size_bytes, content) \
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![
                            new_sms.sms.sms_id,
                            media.media_index,
                            media.content_type,
                            media.filename,
                            media.source_url,
                            i64::try_from(media.size_bytes).unwrap_or(i64::MAX),
                            content,
                        ],
                    )?;
                }
                transaction.execute(
                    "INSERT INTO sms_status_history (sms_id, sequence, status, error_code, at) VALUES (?1, 1, ?2, ?3, ?4)",
                    params![new_sms.sms.sms_id, new_sms.sms.status, new_sms.sms.error_code, new_sms.sms.created_at_unix_ms],
                )?;
                transaction.commit()?;
                Ok(())
            })
            .await
    }

    pub async fn find_message(&self, sms_id: &str) -> Result<Option<SmsRecord>, StoreError> {
        let sms_id = sms_id.to_owned();
        self.database
            .read(move |connection| {
                let found = connection
                    .query_row(
                        &format!("SELECT {SMS_COLUMNS} FROM sms_messages WHERE id = ?1"),
                        [sms_id],
                        read_sms_row,
                    )
                    .optional()?;
                let mut messages: Vec<SmsRecord> = found.into_iter().collect();
                attach_media(connection, &mut messages)?;
                Ok(messages.pop())
            })
            .await
    }

    pub async fn list_messages(
        &self,
        filter: SmsListFilter,
        cursor: Option<String>,
        limit: u32,
    ) -> Result<SmsPage, StoreError> {
        self.database
            .read(move |connection| {
                Ok(sms_reader::list_messages(
                    connection,
                    &filter,
                    cursor.as_deref(),
                    limit,
                )?)
            })
            .await
    }

    pub async fn list_threads(&self) -> Result<Vec<SmsThreadRecord>, StoreError> {
        self.database
            .read(|connection| Ok(sms_reader::list_threads(connection)?))
            .await
    }

    /// Messages created at or after the time, counted by the API that sent them (`native` or a
    /// provider key).
    pub async fn count_messages_by_api_since(
        &self,
        since_unix_ms: i64,
    ) -> Result<HashMap<String, u32>, StoreError> {
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(
                    "SELECT api, COUNT(*) FROM sms_messages WHERE created_at >= ?1 GROUP BY api",
                )?;
                Ok(statement
                    .query_map([since_unix_ms], |row| Ok((row.get(0)?, row.get(1)?)))?
                    .collect::<rusqlite::Result<_>>()?)
            })
            .await
    }

    pub async fn list_status_history(
        &self,
        sms_id: &str,
    ) -> Result<Vec<SmsStatusChangeRecord>, StoreError> {
        let sms_id = sms_id.to_owned();
        self.database
            .read(move |connection| {
                let mut statement = connection
                    .prepare("SELECT status, error_code, at FROM sms_status_history WHERE sms_id = ?1 ORDER BY sequence")?;
                let history = statement
                    .query_map([sms_id], |row| {
                        Ok(SmsStatusChangeRecord { status: row.get(0)?, error_code: row.get(1)?, at_unix_ms: row.get(2)? })
                    })?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(history)
            })
            .await
    }

    /// Sets the status, appends it to the history and answers the updated message.
    pub async fn record_status_change(
        &self,
        sms_id: &str,
        status_change: SmsStatusChangeRecord,
    ) -> Result<Option<SmsRecord>, StoreError> {
        let sms_id = sms_id.to_owned();
        let changed_id = sms_id.clone();
        let is_changed = self
            .database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let updated_count = transaction.execute(
                    "UPDATE sms_messages SET status = ?2, error_code = ?3, updated_at = ?4 WHERE id = ?1",
                    params![sms_id, status_change.status, status_change.error_code, status_change.at_unix_ms],
                )?;
                if updated_count > 0 {
                    transaction.execute(
                        "INSERT INTO sms_status_history (sms_id, sequence, status, error_code, at) \
                         SELECT ?1, coalesce(max(sequence), 0) + 1, ?2, ?3, ?4 FROM sms_status_history WHERE sms_id = ?1",
                        params![sms_id, status_change.status, status_change.error_code, status_change.at_unix_ms],
                    )?;
                }
                transaction.commit()?;
                Ok(updated_count > 0)
            })
            .await?;
        if !is_changed {
            return Ok(None);
        }
        self.find_message(&changed_id).await
    }

    pub async fn add_callback_attempt(
        &self,
        callback_attempt: SmsCallbackAttemptRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT INTO sms_callback_attempts (id, sms_id, reported_status, attempt, request, response, duration_ms, error_message, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        callback_attempt.attempt_id,
                        callback_attempt.sms_id,
                        callback_attempt.reported_status,
                        callback_attempt.attempt,
                        callback_attempt.request_json,
                        callback_attempt.response_json,
                        callback_attempt.duration_ms.map(|duration_ms| i64::try_from(duration_ms).unwrap_or(i64::MAX)),
                        callback_attempt.error_message,
                        callback_attempt.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn list_callback_attempts(
        &self,
        sms_id: &str,
    ) -> Result<Vec<SmsCallbackAttemptRecord>, StoreError> {
        let sms_id = sms_id.to_owned();
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(
                    "SELECT id, sms_id, reported_status, attempt, request, response, duration_ms, error_message, created_at \
                     FROM sms_callback_attempts WHERE sms_id = ?1 ORDER BY created_at, id",
                )?;
                let attempts = statement
                    .query_map([sms_id], |row| {
                        let duration_ms: Option<i64> = row.get(6)?;
                        Ok(SmsCallbackAttemptRecord {
                            attempt_id: row.get(0)?,
                            sms_id: row.get(1)?,
                            reported_status: row.get(2)?,
                            attempt: row.get(3)?,
                            request_json: row.get(4)?,
                            response_json: row.get(5)?,
                            duration_ms: duration_ms.map(|duration_ms| u64::try_from(duration_ms).unwrap_or_default()),
                            error_message: row.get(7)?,
                            created_at_unix_ms: row.get(8)?,
                        })
                    })?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(attempts)
            })
            .await
    }

    pub async fn read_media_content(
        &self,
        sms_id: &str,
        media_index: u32,
    ) -> Result<Option<SmsMediaContent>, StoreError> {
        let sms_id = sms_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        "SELECT content_type, filename, content FROM sms_media WHERE sms_id = ?1 AND media_index = ?2",
                        params![sms_id, media_index],
                        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                    )
                    .optional()?)
            })
            .await
    }
}
