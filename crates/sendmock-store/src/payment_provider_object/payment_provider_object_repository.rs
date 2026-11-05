use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::PaymentProviderObjectRecord;
use crate::{Database, StoreError};

const OBJECT_COLUMNS: &str =
    "object_id, provider, object_kind, payment_id, document, created_at, updated_at";

/// Provider adapters' own objects beside payments; they go when their payment goes.
#[derive(Clone)]
pub struct PaymentProviderObjectRepository {
    database: Arc<Database>,
}

fn read_object_row(row: &Row<'_>) -> rusqlite::Result<PaymentProviderObjectRecord> {
    Ok(PaymentProviderObjectRecord {
        object_id: row.get(0)?,
        provider: row.get(1)?,
        object_kind: row.get(2)?,
        payment_id: row.get(3)?,
        document_json: row.get(4)?,
        created_at_unix_ms: row.get(5)?,
        updated_at_unix_ms: row.get(6)?,
    })
}

impl PaymentProviderObjectRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Creates the object, or replaces its document when the id is already stored.
    pub async fn save_object(
        &self,
        provider_object: PaymentProviderObjectRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!(
                        "INSERT INTO payment_provider_objects ({OBJECT_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) \
                         ON CONFLICT (object_id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at"
                    ),
                    params![
                        provider_object.object_id,
                        provider_object.provider,
                        provider_object.object_kind,
                        provider_object.payment_id,
                        provider_object.document_json,
                        provider_object.created_at_unix_ms,
                        provider_object.updated_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    /// The provider's object with this id, of this provider and kind.
    pub async fn find_object(
        &self,
        provider: &str,
        object_kind: &str,
        object_id: &str,
    ) -> Result<Option<PaymentProviderObjectRecord>, StoreError> {
        let query_values = [provider, object_kind, object_id].map(str::to_owned);
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!(
                            "SELECT {OBJECT_COLUMNS} FROM payment_provider_objects \
                             WHERE provider = ?1 AND object_kind = ?2 AND object_id = ?3"
                        ),
                        params![query_values[0], query_values[1], query_values[2]],
                        read_object_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// A payment's objects of one kind, oldest first.
    pub async fn list_payment_objects(
        &self,
        payment_id: &str,
        object_kind: &str,
    ) -> Result<Vec<PaymentProviderObjectRecord>, StoreError> {
        let query_values = [payment_id, object_kind].map(str::to_owned);
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {OBJECT_COLUMNS} FROM payment_provider_objects \
                     WHERE payment_id = ?1 AND object_kind = ?2 ORDER BY created_at, object_id"
                ))?;
                let provider_objects = statement
                    .query_map(params![query_values[0], query_values[1]], read_object_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(provider_objects)
            })
            .await
    }
}
