use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::{SmtpSessionPage, SmtpSessionRecord};
use crate::{Database, StoreError};

const SESSION_COLUMNS: &str = "id, started_at, ended_at, remote_address, helo_name, tls_version, auth_mechanism, \
     auth_user, result, failure_reason, email_ids, transcript";

/// Every SMTP session log query.
#[derive(Clone)]
pub struct SmtpSessionRepository {
    database: Arc<Database>,
}

impl SmtpSessionRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn insert_session(&self, session: SmtpSessionRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT INTO smtp_sessions ({SESSION_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"),
                    params![
                        session.session_id,
                        session.started_at_unix_ms,
                        session.ended_at_unix_ms,
                        session.remote_address,
                        session.helo_name,
                        session.tls_version,
                        session.auth_mechanism,
                        session.auth_user,
                        session.result,
                        session.failure_reason,
                        serde_json::to_string(&session.email_ids).unwrap_or_else(|_| "[]".to_owned()),
                        session.transcript,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn find_session(
        &self,
        session_id: &str,
    ) -> Result<Option<SmtpSessionRecord>, StoreError> {
        let session_id = session_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {SESSION_COLUMNS} FROM smtp_sessions WHERE id = ?1"),
                        [session_id],
                        read_session_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Newest first; `cursor` is the id of the last session of the previous page.
    pub async fn list_sessions(
        &self,
        cursor: Option<String>,
        limit: u32,
    ) -> Result<SmtpSessionPage, StoreError> {
        self.database
            .read(move |connection| {
                let total_count: i64 = connection.query_row("SELECT count(*) FROM smtp_sessions", [], |row| row.get(0))?;
                let mut statement = connection.prepare(&format!(
                    "SELECT {SESSION_COLUMNS} FROM smtp_sessions WHERE (?1 IS NULL OR id < ?1) ORDER BY id DESC LIMIT ?2"
                ))?;
                let mut sessions = statement
                    .query_map(params![cursor, i64::from(limit) + 1], read_session_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                let has_more = sessions.len() > limit as usize;
                sessions.truncate(limit as usize);
                Ok(SmtpSessionPage {
                    next_cursor: has_more.then(|| sessions.last().map(|session| session.session_id.clone())).flatten(),
                    sessions,
                    total_count: u64::try_from(total_count).unwrap_or_default(),
                })
            })
            .await
    }
}

fn read_session_row(row: &Row<'_>) -> rusqlite::Result<SmtpSessionRecord> {
    let email_ids_json: String = row.get(10)?;
    Ok(SmtpSessionRecord {
        session_id: row.get(0)?,
        started_at_unix_ms: row.get(1)?,
        ended_at_unix_ms: row.get(2)?,
        remote_address: row.get(3)?,
        helo_name: row.get(4)?,
        tls_version: row.get(5)?,
        auth_mechanism: row.get(6)?,
        auth_user: row.get(7)?,
        result: row.get(8)?,
        failure_reason: row.get(9)?,
        email_ids: serde_json::from_str(&email_ids_json).unwrap_or_default(),
        transcript: row.get(11)?,
    })
}
