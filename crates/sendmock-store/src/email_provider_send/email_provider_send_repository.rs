use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::EmailProviderSendRecord;
use crate::{Database, StoreError};

const SEND_COLUMNS: &str =
    "email_id, provider_key, provider_message_id, template_id, template_data";

/// Provider sends beside their emails; they go when their email goes.
#[derive(Clone)]
pub struct EmailProviderSendRepository {
    database: Arc<Database>,
}

fn read_send_row(row: &Row<'_>) -> rusqlite::Result<EmailProviderSendRecord> {
    Ok(EmailProviderSendRecord {
        email_id: row.get(0)?,
        provider_key: row.get(1)?,
        provider_message_id: row.get(2)?,
        template_id: row.get(3)?,
        template_data_json: row.get(4)?,
    })
}

impl EmailProviderSendRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn save_send(
        &self,
        provider_send: EmailProviderSendRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!(
                        "INSERT OR REPLACE INTO email_provider_sends ({SEND_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5)"
                    ),
                    params![
                        provider_send.email_id,
                        provider_send.provider_key,
                        provider_send.provider_message_id,
                        provider_send.template_id,
                        provider_send.template_data_json,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn find_send(
        &self,
        email_id: &str,
    ) -> Result<Option<EmailProviderSendRecord>, StoreError> {
        let email_id = email_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!(
                            "SELECT {SEND_COLUMNS} FROM email_provider_sends WHERE email_id = ?1"
                        ),
                        [email_id],
                        read_send_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// The email a provider knows by its own message id, the newest when several share it.
    pub async fn find_send_by_provider_message_id(
        &self,
        provider_key: &str,
        provider_message_id: &str,
    ) -> Result<Option<EmailProviderSendRecord>, StoreError> {
        let query_values = [provider_key, provider_message_id].map(str::to_owned);
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!(
                            "SELECT {SEND_COLUMNS} FROM email_provider_sends \
                             WHERE provider_key = ?1 AND provider_message_id = ?2 \
                             ORDER BY email_id DESC LIMIT 1"
                        ),
                        params![query_values[0], query_values[1]],
                        read_send_row,
                    )
                    .optional()?)
            })
            .await
    }
}
