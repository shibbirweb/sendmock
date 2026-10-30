use std::sync::Arc;

use rusqlite::{Connection, OptionalExtension, Row, params};

use super::MessagingServiceRecord;
use crate::{Database, StoreError};

const SERVICE_COLUMNS: &str =
    "sid, friendly_name, inbound_mode, inbound_url, inbound_fallback_url, created_by, created_at";

/// Messaging Services; the sender pool is read from and written to the numbers, so a number
/// is in at most one pool and moving it updates both services.
#[derive(Clone)]
pub struct MessagingServiceRepository {
    database: Arc<Database>,
}

impl MessagingServiceRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn list_services(&self) -> Result<Vec<MessagingServiceRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {SERVICE_COLUMNS} FROM messaging_services ORDER BY created_at, rowid"
                ))?;
                let mut services = statement
                    .query_map([], read_service_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                for service in &mut services {
                    service.number_ids = select_pool(connection, &service.service_sid)?;
                }
                Ok(services)
            })
            .await
    }

    pub async fn find_service(
        &self,
        service_sid: &str,
    ) -> Result<Option<MessagingServiceRecord>, StoreError> {
        let service_sid = service_sid.to_owned();
        self.database
            .read(move |connection| Ok(select_service(connection, &service_sid)?))
            .await
    }

    /// Stores the service, or saves its editable fields when it exists, and makes its pool
    /// exactly `number_ids`, taking those numbers out of any other pool.
    pub async fn save_service(
        &self,
        service: MessagingServiceRecord,
    ) -> Result<MessagingServiceRecord, StoreError> {
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                transaction.execute(
                    &format!("INSERT INTO messaging_services ({SERVICE_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) \
                     ON CONFLICT (sid) DO UPDATE SET friendly_name = excluded.friendly_name, inbound_mode = excluded.inbound_mode, inbound_url = excluded.inbound_url, inbound_fallback_url = excluded.inbound_fallback_url"),
                    params![
                        service.service_sid,
                        service.friendly_name,
                        service.inbound_mode,
                        service.inbound_url,
                        service.inbound_fallback_url,
                        service.created_by,
                        service.created_at_unix_ms,
                    ],
                )?;
                transaction.execute(
                    "UPDATE virtual_numbers SET messaging_service_sid = NULL WHERE messaging_service_sid = ?1",
                    [&service.service_sid],
                )?;
                for number_id in &service.number_ids {
                    transaction.execute(
                        "UPDATE virtual_numbers SET messaging_service_sid = ?1 WHERE id = ?2",
                        params![service.service_sid, number_id],
                    )?;
                }
                let saved_service = select_service(&transaction, &service.service_sid)?;
                transaction.commit()?;
                Ok(saved_service.unwrap_or(service))
            })
            .await
    }

    /// Deletes the service; its numbers stay, outside any pool.
    pub async fn delete_service(&self, service_sid: &str) -> Result<bool, StoreError> {
        let service_sid = service_sid.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "DELETE FROM messaging_services WHERE sid = ?1",
                    [service_sid],
                )? > 0)
            })
            .await
    }
}

fn select_service(
    connection: &Connection,
    service_sid: &str,
) -> rusqlite::Result<Option<MessagingServiceRecord>> {
    let service = connection
        .query_row(
            &format!("SELECT {SERVICE_COLUMNS} FROM messaging_services WHERE sid = ?1"),
            [service_sid],
            read_service_row,
        )
        .optional()?;
    match service {
        Some(mut service) => {
            service.number_ids = select_pool(connection, service_sid)?;
            Ok(Some(service))
        }
        None => Ok(None),
    }
}

fn select_pool(connection: &Connection, service_sid: &str) -> rusqlite::Result<Vec<String>> {
    let mut statement = connection.prepare(
        "SELECT id FROM virtual_numbers WHERE messaging_service_sid = ?1 ORDER BY created_at, rowid",
    )?;
    statement
        .query_map([service_sid], |row| row.get(0))?
        .collect()
}

fn read_service_row(row: &Row<'_>) -> rusqlite::Result<MessagingServiceRecord> {
    Ok(MessagingServiceRecord {
        service_sid: row.get(0)?,
        friendly_name: row.get(1)?,
        number_ids: Vec::new(),
        inbound_mode: row.get(2)?,
        inbound_url: row.get(3)?,
        inbound_fallback_url: row.get(4)?,
        created_by: row.get(5)?,
        created_at_unix_ms: row.get(6)?,
    })
}
