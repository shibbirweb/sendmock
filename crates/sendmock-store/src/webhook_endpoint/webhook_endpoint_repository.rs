use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::{WebhookEndpointRecord, WebhookSecretRotation};
use crate::{Database, StoreError};

const ENDPOINT_COLUMNS: &str = "id, name, url, is_enabled, request_settings, signing_secret, previous_signing_secret, previous_secret_expires_at, created_by, created_at";

/// Webhook endpoints with their signing secrets.
#[derive(Clone)]
pub struct WebhookEndpointRepository {
    database: Arc<Database>,
}

impl WebhookEndpointRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Every endpoint, oldest first.
    pub async fn list_endpoints(&self) -> Result<Vec<WebhookEndpointRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {ENDPOINT_COLUMNS} FROM webhook_endpoints ORDER BY created_at, id"
                ))?;
                let endpoints = statement
                    .query_map([], read_endpoint_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(endpoints)
            })
            .await
    }

    pub async fn find_endpoint(
        &self,
        endpoint_id: &str,
    ) -> Result<Option<WebhookEndpointRecord>, StoreError> {
        let endpoint_id = endpoint_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {ENDPOINT_COLUMNS} FROM webhook_endpoints WHERE id = ?1"),
                        [endpoint_id],
                        read_endpoint_row,
                    )
                    .optional()?)
            })
            .await
    }

    pub async fn insert_endpoint(
        &self,
        new_endpoint: WebhookEndpointRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT INTO webhook_endpoints ({ENDPOINT_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"),
                    params![
                        new_endpoint.endpoint_id,
                        new_endpoint.name,
                        new_endpoint.url,
                        new_endpoint.is_enabled,
                        new_endpoint.request_settings_json,
                        new_endpoint.signing_secret,
                        new_endpoint.previous_signing_secret,
                        new_endpoint.previous_secret_expires_at_unix_ms,
                        new_endpoint.created_by,
                        new_endpoint.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    /// Saves the name, URL, enabled state and request settings; secrets and the creator stay.
    /// False when the endpoint is gone.
    pub async fn update_endpoint(
        &self,
        changed_endpoint: WebhookEndpointRecord,
    ) -> Result<bool, StoreError> {
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE webhook_endpoints SET name = ?2, url = ?3, is_enabled = ?4, request_settings = ?5 WHERE id = ?1",
                    params![
                        changed_endpoint.endpoint_id,
                        changed_endpoint.name,
                        changed_endpoint.url,
                        changed_endpoint.is_enabled,
                        changed_endpoint.request_settings_json,
                    ],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    /// Makes the current secret the previous one until the rotation's expiry and stores the new
    /// one. False when the endpoint is gone.
    pub async fn rotate_signing_secret(
        &self,
        endpoint_id: &str,
        secret_rotation: WebhookSecretRotation,
    ) -> Result<bool, StoreError> {
        let endpoint_id = endpoint_id.to_owned();
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE webhook_endpoints SET previous_signing_secret = signing_secret, previous_secret_expires_at = ?2, signing_secret = ?3 WHERE id = ?1",
                    params![
                        endpoint_id,
                        secret_rotation.previous_secret_expires_at_unix_ms,
                        secret_rotation.new_signing_secret,
                    ],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    pub async fn delete_endpoint(&self, endpoint_id: &str) -> Result<bool, StoreError> {
        let endpoint_id = endpoint_id.to_owned();
        self.database
            .write(move |connection| {
                let deleted_count = connection
                    .execute("DELETE FROM webhook_endpoints WHERE id = ?1", [endpoint_id])?;
                Ok(deleted_count > 0)
            })
            .await
    }
}

fn read_endpoint_row(row: &Row<'_>) -> rusqlite::Result<WebhookEndpointRecord> {
    Ok(WebhookEndpointRecord {
        endpoint_id: row.get(0)?,
        name: row.get(1)?,
        url: row.get(2)?,
        is_enabled: row.get(3)?,
        request_settings_json: row.get(4)?,
        signing_secret: row.get(5)?,
        previous_signing_secret: row.get(6)?,
        previous_secret_expires_at_unix_ms: row.get(7)?,
        created_by: row.get(8)?,
        created_at_unix_ms: row.get(9)?,
    })
}
