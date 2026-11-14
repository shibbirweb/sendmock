use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::SavedWebhookDeliveryRecord;
use crate::{Database, StoreError};

const SAVED_DELIVERY_COLUMNS: &str =
    "id, name, endpoint_id, event_type, event, template_id, request, saved_at";

/// Saved deliveries, newest first. They are configuration, so nothing here is pruned or reset.
#[derive(Clone)]
pub struct SavedWebhookDeliveryRepository {
    database: Arc<Database>,
}

impl SavedWebhookDeliveryRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Every saved delivery, the last saved first; ULIDs made in the same millisecond do not
    /// sort, so ties go by insertion order.
    pub async fn list_saved_deliveries(
        &self,
    ) -> Result<Vec<SavedWebhookDeliveryRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {SAVED_DELIVERY_COLUMNS} FROM saved_webhook_deliveries ORDER BY saved_at DESC, rowid DESC"
                ))?;
                let saved_deliveries = statement
                    .query_map([], read_saved_delivery_row)?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(saved_deliveries)
            })
            .await
    }

    pub async fn find_saved_delivery(
        &self,
        saved_id: &str,
    ) -> Result<Option<SavedWebhookDeliveryRecord>, StoreError> {
        let saved_id = saved_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!(
                            "SELECT {SAVED_DELIVERY_COLUMNS} FROM saved_webhook_deliveries WHERE id = ?1"
                        ),
                        [saved_id],
                        read_saved_delivery_row,
                    )
                    .optional()?)
            })
            .await
    }

    pub async fn insert_saved_delivery(
        &self,
        new_saved_delivery: SavedWebhookDeliveryRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT INTO saved_webhook_deliveries ({SAVED_DELIVERY_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"),
                    params![
                        new_saved_delivery.saved_id,
                        new_saved_delivery.name,
                        new_saved_delivery.endpoint_id,
                        new_saved_delivery.event_type,
                        new_saved_delivery.event_json,
                        new_saved_delivery.template_id,
                        new_saved_delivery.request_json,
                        new_saved_delivery.saved_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    /// False when the saved delivery is gone.
    pub async fn rename_saved_delivery(
        &self,
        saved_id: &str,
        new_name: &str,
    ) -> Result<bool, StoreError> {
        let saved_id = saved_id.to_owned();
        let new_name = new_name.to_owned();
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE saved_webhook_deliveries SET name = ?2 WHERE id = ?1",
                    params![saved_id, new_name],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    pub async fn delete_saved_delivery(&self, saved_id: &str) -> Result<bool, StoreError> {
        let saved_id = saved_id.to_owned();
        self.database
            .write(move |connection| {
                let deleted_count = connection.execute(
                    "DELETE FROM saved_webhook_deliveries WHERE id = ?1",
                    [saved_id],
                )?;
                Ok(deleted_count > 0)
            })
            .await
    }

    /// Keeps the saved deliveries of a deleted endpoint, without the endpoint.
    pub async fn forget_endpoint(&self, endpoint_id: &str) -> Result<usize, StoreError> {
        let endpoint_id = endpoint_id.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "UPDATE saved_webhook_deliveries SET endpoint_id = NULL WHERE endpoint_id = ?1",
                    [endpoint_id],
                )?)
            })
            .await
    }
}

fn read_saved_delivery_row(row: &Row<'_>) -> rusqlite::Result<SavedWebhookDeliveryRecord> {
    Ok(SavedWebhookDeliveryRecord {
        saved_id: row.get(0)?,
        name: row.get(1)?,
        endpoint_id: row.get(2)?,
        event_type: row.get(3)?,
        event_json: row.get(4)?,
        template_id: row.get(5)?,
        request_json: row.get(6)?,
        saved_at_unix_ms: row.get(7)?,
    })
}
