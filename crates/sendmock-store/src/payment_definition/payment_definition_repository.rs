use std::sync::Arc;

use rusqlite::params;

use super::PaymentDefinitionRecord;
use crate::{Database, StoreError};

/// Edited built-in and custom payment flows, methods and gateways.
#[derive(Clone)]
pub struct PaymentDefinitionRepository {
    database: Arc<Database>,
}

impl PaymentDefinitionRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// The stored definitions of a kind, in the order they were first saved.
    pub async fn list_definitions(
        &self,
        kind: &str,
    ) -> Result<Vec<PaymentDefinitionRecord>, StoreError> {
        let kind = kind.to_owned();
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(
                    "SELECT kind, definition_key, definition, updated_at FROM payment_definitions WHERE kind = ?1 ORDER BY rowid",
                )?;
                let definitions = statement
                    .query_map([kind], |row| {
                        Ok(PaymentDefinitionRecord {
                            kind: row.get(0)?,
                            definition_key: row.get(1)?,
                            definition_json: row.get(2)?,
                            updated_at_unix_ms: row.get(3)?,
                        })
                    })?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(definitions)
            })
            .await
    }

    /// Creates or replaces the definition with this kind and key; a replaced one keeps its place.
    pub async fn save_definition(
        &self,
        definition: PaymentDefinitionRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT INTO payment_definitions (kind, definition_key, definition, updated_at) VALUES (?1, ?2, ?3, ?4) \
                     ON CONFLICT (kind, definition_key) DO UPDATE SET definition = excluded.definition, updated_at = excluded.updated_at",
                    params![
                        definition.kind,
                        definition.definition_key,
                        definition.definition_json,
                        definition.updated_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    /// False when there was nothing stored.
    pub async fn delete_definition(
        &self,
        kind: &str,
        definition_key: &str,
    ) -> Result<bool, StoreError> {
        let (kind, definition_key) = (kind.to_owned(), definition_key.to_owned());
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "DELETE FROM payment_definitions WHERE kind = ?1 AND definition_key = ?2",
                    params![kind, definition_key],
                )? > 0)
            })
            .await
    }
}
