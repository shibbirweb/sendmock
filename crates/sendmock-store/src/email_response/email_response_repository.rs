use std::sync::Arc;

use rusqlite::{OptionalExtension, params};

use crate::{Database, StoreError};

/// A reply or forward and the email it answers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailResponseRecord {
    pub email_id: String,
    /// `reply` or `forward`.
    pub response_kind: String,
    pub original_email_id: String,
}

/// Links simulated replies and forwards to their originals, both ways.
#[derive(Clone)]
pub struct EmailResponseRepository {
    database: Arc<Database>,
}

impl EmailResponseRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn save_response(&self, response: EmailResponseRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT OR REPLACE INTO email_responses (email_id, response_kind, original_email_id) VALUES (?1, ?2, ?3)",
                    params![response.email_id, response.response_kind, response.original_email_id],
                )?;
                Ok(())
            })
            .await
    }

    /// What the email answers, when it is a reply or a forward.
    pub async fn find_response(
        &self,
        email_id: &str,
    ) -> Result<Option<EmailResponseRecord>, StoreError> {
        let email_id = email_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        "SELECT email_id, response_kind, original_email_id FROM email_responses WHERE email_id = ?1",
                        [email_id],
                        |row| {
                            Ok(EmailResponseRecord {
                                email_id: row.get(0)?,
                                response_kind: row.get(1)?,
                                original_email_id: row.get(2)?,
                            })
                        },
                    )
                    .optional()?)
            })
            .await
    }

    /// The replies and forwards of an email, oldest first.
    pub async fn list_responses(
        &self,
        original_email_id: &str,
    ) -> Result<Vec<EmailResponseRecord>, StoreError> {
        let original_email_id = original_email_id.to_owned();
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(
                    "SELECT email_id, response_kind, original_email_id FROM email_responses WHERE original_email_id = ?1 ORDER BY rowid",
                )?;
                let responses = statement
                    .query_map([original_email_id], |row| {
                        Ok(EmailResponseRecord {
                            email_id: row.get(0)?,
                            response_kind: row.get(1)?,
                            original_email_id: row.get(2)?,
                        })
                    })?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(responses)
            })
            .await
    }
}
