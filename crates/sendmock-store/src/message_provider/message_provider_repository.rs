use std::sync::Arc;

use rusqlite::{Row, params};

use super::MessageProviderRecord;
use crate::{Database, StoreError};

const PROVIDER_COLUMNS: &str = "area, provider_key, definition, is_removed, updated_at";

#[derive(Clone)]
pub struct MessageProviderRepository {
    database: Arc<Database>,
}

impl MessageProviderRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// The stored providers of one area, in the order they were first saved.
    pub async fn list_providers(
        &self,
        area: &str,
    ) -> Result<Vec<MessageProviderRecord>, StoreError> {
        let area = area.to_owned();
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {PROVIDER_COLUMNS} FROM message_providers WHERE area = ?1 ORDER BY rowid"
                ))?;
                Ok(statement
                    .query_map([area], read_provider_row)?
                    .collect::<rusqlite::Result<_>>()?)
            })
            .await
    }

    /// Stores a provider, or replaces the stored one with the same area and key.
    pub async fn save_provider(&self, provider: MessageProviderRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT INTO message_providers ({PROVIDER_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5) \
                     ON CONFLICT (area, provider_key) DO UPDATE SET definition = excluded.definition, is_removed = excluded.is_removed, updated_at = excluded.updated_at"),
                    params![
                        provider.area,
                        provider.provider_key,
                        provider.definition_json,
                        provider.is_removed,
                        provider.updated_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn delete_provider(
        &self,
        area: &str,
        provider_key: &str,
    ) -> Result<bool, StoreError> {
        let area = area.to_owned();
        let provider_key = provider_key.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "DELETE FROM message_providers WHERE area = ?1 AND provider_key = ?2",
                    [area, provider_key],
                )? > 0)
            })
            .await
    }
}

fn read_provider_row(row: &Row<'_>) -> rusqlite::Result<MessageProviderRecord> {
    Ok(MessageProviderRecord {
        area: row.get(0)?,
        provider_key: row.get(1)?,
        definition_json: row.get(2)?,
        is_removed: row.get(3)?,
        updated_at_unix_ms: row.get(4)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DatabaseLocation, EMBEDDED_MIGRATIONS};

    fn build_repository() -> MessageProviderRepository {
        let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
            .unwrap_or_else(|error| panic!("the database opens: {error}"));
        MessageProviderRepository::new(Arc::new(database))
    }

    fn removed_twilio(updated_at_unix_ms: i64) -> MessageProviderRecord {
        MessageProviderRecord {
            area: "sms".to_owned(),
            provider_key: "twilio".to_owned(),
            definition_json: None,
            is_removed: true,
            updated_at_unix_ms,
        }
    }

    #[tokio::test]
    async fn saving_a_provider_twice_replaces_it_and_delete_takes_it_out() {
        let repository = build_repository();
        repository
            .save_provider(removed_twilio(1))
            .await
            .unwrap_or_else(|error| panic!("saved: {error}"));
        let edited_twilio = MessageProviderRecord {
            definition_json: Some("{\"name\":\"Twilio EU\"}".to_owned()),
            is_removed: false,
            ..removed_twilio(2)
        };
        repository
            .save_provider(edited_twilio.clone())
            .await
            .unwrap_or_else(|error| panic!("saved: {error}"));

        let stored_providers = repository
            .list_providers("sms")
            .await
            .unwrap_or_else(|error| panic!("listed: {error}"));
        let email_providers = repository
            .list_providers("email")
            .await
            .unwrap_or_else(|error| panic!("listed: {error}"));
        let was_deleted = repository
            .delete_provider("sms", "twilio")
            .await
            .unwrap_or_else(|error| panic!("deleted: {error}"));

        assert_eq!(stored_providers, vec![edited_twilio]);
        assert!(email_providers.is_empty());
        assert!(was_deleted);
    }
}
