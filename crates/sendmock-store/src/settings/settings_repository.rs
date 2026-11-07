use std::sync::Arc;

use rusqlite::{OptionalExtension, params};

use crate::{Database, StoreError};

/// Settings are stored as one JSON value per key, so a new setting needs no migration.
#[derive(Clone)]
pub struct SettingsRepository {
    database: Arc<Database>,
}

impl SettingsRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn read_value(&self, setting_key: &str) -> Result<Option<String>, StoreError> {
        let setting_key = setting_key.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        "SELECT value FROM settings WHERE key = ?1",
                        [setting_key],
                        |row| row.get(0),
                    )
                    .optional()?)
            })
            .await
    }

    pub async fn write_value(
        &self,
        setting_key: &str,
        setting_value: String,
        updated_at_unix_ms: i64,
    ) -> Result<(), StoreError> {
        let setting_key = setting_key.to_owned();
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) \
                     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                    params![setting_key, setting_value, updated_at_unix_ms],
                )?;
                Ok(())
            })
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DatabaseLocation, EMBEDDED_MIGRATIONS};

    #[tokio::test]
    async fn writes_then_overwrites_a_value() -> Result<(), StoreError> {
        let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)?;
        let repository = SettingsRepository::new(Arc::new(database));

        repository
            .write_value("app", "{\"a\":1}".to_owned(), 1)
            .await?;
        repository
            .write_value("app", "{\"a\":2}".to_owned(), 2)
            .await?;

        assert_eq!(
            repository.read_value("app").await?.as_deref(),
            Some("{\"a\":2}")
        );
        assert_eq!(repository.read_value("missing").await?, None);
        Ok(())
    }
}
