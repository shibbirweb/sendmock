use std::sync::Arc;

use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};

use super::verification_reader::{VERIFICATION_COLUMNS, read_verification_row, select_page};
use super::{VerificationFilter, VerificationPage, VerificationRecord, VerificationTimelineRecord};
use crate::{Database, StoreError};

#[derive(Clone)]
pub struct VerificationRepository {
    database: Arc<Database>,
}

impl VerificationRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn insert_verification(
        &self,
        verification: VerificationRecord,
        timeline_entries: Vec<VerificationTimelineRecord>,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                transaction.execute(
                    &format!("INSERT INTO verifications ({VERIFICATION_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)"),
                    params![
                        verification.verification_sid,
                        verification.service_sid,
                        verification.service_name,
                        verification.account_sid,
                        verification.to_address,
                        verification.channel,
                        verification.code,
                        verification.status,
                        verification.check_attempts,
                        verification.send_attempts,
                        verification.expires_at_unix_ms,
                        verification.linked_message_id,
                        verification.linked_thread_id,
                        verification.created_at_unix_ms,
                        verification.updated_at_unix_ms,
                    ],
                )?;
                append_timeline(&transaction, &verification.verification_sid, &timeline_entries)?;
                transaction.commit()?;
                Ok(())
            })
            .await
    }

    /// Saves the fields a check, resend or forced state changes, and appends to the timeline.
    pub async fn save_progress(
        &self,
        verification: VerificationRecord,
        timeline_entries: Vec<VerificationTimelineRecord>,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                transaction.execute(
                    "UPDATE verifications SET code = ?2, status = ?3, check_attempts = ?4, send_attempts = ?5, expires_at = ?6, linked_message_id = ?7, linked_thread_id = ?8, updated_at = ?9 WHERE sid = ?1",
                    params![
                        verification.verification_sid,
                        verification.code,
                        verification.status,
                        verification.check_attempts,
                        verification.send_attempts,
                        verification.expires_at_unix_ms,
                        verification.linked_message_id,
                        verification.linked_thread_id,
                        verification.updated_at_unix_ms,
                    ],
                )?;
                append_timeline(&transaction, &verification.verification_sid, &timeline_entries)?;
                transaction.commit()?;
                Ok(())
            })
            .await
    }

    pub async fn find_verification(
        &self,
        verification_sid: &str,
    ) -> Result<Option<VerificationRecord>, StoreError> {
        self.find_one(
            "sid = ?1",
            vec![SqlValue::Text(verification_sid.to_owned())],
        )
        .await
    }

    /// The newest pending verification of a service for a recipient, to resend or check.
    pub async fn find_pending(
        &self,
        service_sid: &str,
        to_address: &str,
    ) -> Result<Option<VerificationRecord>, StoreError> {
        self.find_one(
            "service_sid = ?1 AND to_address = ?2 AND status = 'pending'",
            vec![
                SqlValue::Text(service_sid.to_owned()),
                SqlValue::Text(to_address.to_owned()),
            ],
        )
        .await
    }

    /// The newest verification for a recipient, whatever its service, for `/otp`.
    pub async fn find_newest_for_recipient(
        &self,
        to_address: &str,
    ) -> Result<Option<VerificationRecord>, StoreError> {
        self.find_one(
            "to_address = ?1",
            vec![SqlValue::Text(to_address.to_owned())],
        )
        .await
    }

    async fn find_one(
        &self,
        condition: &'static str,
        parameters: Vec<SqlValue>,
    ) -> Result<Option<VerificationRecord>, StoreError> {
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {VERIFICATION_COLUMNS} FROM verifications WHERE {condition} ORDER BY created_at DESC, rowid DESC LIMIT 1"),
                        params_from_iter(parameters.iter()),
                        read_verification_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Newest first; `cursor` is the SID of the last verification of the previous page.
    pub async fn list_verifications(
        &self,
        filter: VerificationFilter,
        cursor: Option<String>,
        limit: u32,
    ) -> Result<VerificationPage, StoreError> {
        self.database
            .read(move |connection| Ok(select_page(connection, &filter, cursor.as_deref(), limit)?))
            .await
    }

    pub async fn list_timeline(
        &self,
        verification_sid: &str,
    ) -> Result<Vec<VerificationTimelineRecord>, StoreError> {
        let verification_sid = verification_sid.to_owned();
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(
                    "SELECT kind, at, detail FROM verification_timeline WHERE verification_sid = ?1 ORDER BY sequence",
                )?;
                Ok(statement
                    .query_map([verification_sid], |row| {
                        Ok(VerificationTimelineRecord { kind: row.get(0)?, at_unix_ms: row.get(1)?, detail: row.get(2)? })
                    })?
                    .collect::<rusqlite::Result<_>>()?)
            })
            .await
    }

    /// Pending verifications past their deadline become `expired`, with an `expired` step at
    /// the deadline; answers the ones that changed.
    pub async fn expire_overdue(
        &self,
        now_unix_ms: i64,
    ) -> Result<Vec<VerificationRecord>, StoreError> {
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let overdue: Vec<VerificationRecord> = {
                    let mut statement = transaction.prepare(&format!(
                        "SELECT {VERIFICATION_COLUMNS} FROM verifications WHERE status = 'pending' AND expires_at <= ?1"
                    ))?;
                    statement.query_map([now_unix_ms], read_verification_row)?.collect::<rusqlite::Result<_>>()?
                };
                for verification in &overdue {
                    transaction.execute(
                        "UPDATE verifications SET status = 'expired', updated_at = ?2 WHERE sid = ?1",
                        params![verification.verification_sid, now_unix_ms],
                    )?;
                    append_timeline(
                        &transaction,
                        &verification.verification_sid,
                        &[VerificationTimelineRecord {
                            kind: "expired".to_owned(),
                            at_unix_ms: verification.expires_at_unix_ms,
                            detail: "Not checked before the code expired".to_owned(),
                        }],
                    )?;
                }
                transaction.commit()?;
                Ok(overdue)
            })
            .await
    }

    pub async fn delete_all_verifications(&self) -> Result<u64, StoreError> {
        self.database
            .write(|connection| Ok(connection.execute("DELETE FROM verifications", [])? as u64))
            .await
    }
}

fn append_timeline(
    connection: &Connection,
    verification_sid: &str,
    timeline_entries: &[VerificationTimelineRecord],
) -> rusqlite::Result<()> {
    let next_sequence: i64 = connection.query_row(
        "SELECT COALESCE(MAX(sequence), 0) + 1 FROM verification_timeline WHERE verification_sid = ?1",
        [verification_sid],
        |row| row.get(0),
    )?;
    for (sequence, timeline_entry) in (next_sequence..).zip(timeline_entries) {
        connection.execute(
            "INSERT INTO verification_timeline (verification_sid, sequence, kind, at, detail) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![verification_sid, sequence, timeline_entry.kind, timeline_entry.at_unix_ms, timeline_entry.detail],
        )?;
    }
    Ok(())
}
