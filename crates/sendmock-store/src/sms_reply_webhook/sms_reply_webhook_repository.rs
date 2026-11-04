use std::sync::Arc;

use rusqlite::{Row, params};

use super::SmsReplyWebhookAttemptRecord;
use crate::{Database, StoreError};

const ATTEMPT_COLUMNS: &str = "id, sms_id, is_fallback, request, response, duration_ms, error_code, error_message, twiml, created_at";

/// Reply webhook calls of inbound messages and each message's latest outcome.
#[derive(Clone)]
pub struct SmsReplyWebhookRepository {
    database: Arc<Database>,
}

fn read_attempt_row(row: &Row<'_>) -> rusqlite::Result<SmsReplyWebhookAttemptRecord> {
    let duration_ms: Option<i64> = row.get(5)?;
    Ok(SmsReplyWebhookAttemptRecord {
        attempt_id: row.get(0)?,
        sms_id: row.get(1)?,
        is_fallback: row.get(2)?,
        request_json: row.get(3)?,
        response_json: row.get(4)?,
        duration_ms: duration_ms.map(|duration_ms| u64::try_from(duration_ms).unwrap_or_default()),
        error_code: row.get(6)?,
        error_message: row.get(7)?,
        twiml_json: row.get(8)?,
        created_at_unix_ms: row.get(9)?,
    })
}

impl SmsReplyWebhookRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn insert_attempt(
        &self,
        reply_webhook_attempt: SmsReplyWebhookAttemptRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT INTO sms_reply_webhook_attempts ({ATTEMPT_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"),
                    params![
                        reply_webhook_attempt.attempt_id,
                        reply_webhook_attempt.sms_id,
                        reply_webhook_attempt.is_fallback,
                        reply_webhook_attempt.request_json,
                        reply_webhook_attempt.response_json,
                        reply_webhook_attempt
                            .duration_ms
                            .map(|duration_ms| i64::try_from(duration_ms).unwrap_or(i64::MAX)),
                        reply_webhook_attempt.error_code,
                        reply_webhook_attempt.error_message,
                        reply_webhook_attempt.twiml_json,
                        reply_webhook_attempt.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    /// Every attempt of the message, oldest first, across resends.
    pub async fn list_attempts(
        &self,
        sms_id: &str,
    ) -> Result<Vec<SmsReplyWebhookAttemptRecord>, StoreError> {
        let sms_id = sms_id.to_owned();
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {ATTEMPT_COLUMNS} FROM sms_reply_webhook_attempts WHERE sms_id = ?1 ORDER BY created_at, rowid"
                ))?;
                let attempts = statement
                    .query_map([sms_id], read_attempt_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(attempts)
            })
            .await
    }

    /// Replaces the message's outcome with the latest run's; false when the message is gone.
    pub async fn record_result(
        &self,
        sms_id: &str,
        reply_webhook_json: String,
    ) -> Result<bool, StoreError> {
        let sms_id = sms_id.to_owned();
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE sms_messages SET reply_webhook = ?2 WHERE id = ?1",
                    params![sms_id, reply_webhook_json],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }
}
