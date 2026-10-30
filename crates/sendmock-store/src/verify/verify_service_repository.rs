use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::VerifyServiceRecord;
use crate::{Database, StoreError};

const SERVICE_COLUMNS: &str =
    "sid, friendly_name, code_length, fixed_code, ttl_seconds, created_by, created_at";

#[derive(Clone)]
pub struct VerifyServiceRepository {
    database: Arc<Database>,
}

impl VerifyServiceRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn list_services(&self) -> Result<Vec<VerifyServiceRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {SERVICE_COLUMNS} FROM verify_services ORDER BY created_at, rowid"
                ))?;
                Ok(statement
                    .query_map([], read_service_row)?
                    .collect::<rusqlite::Result<_>>()?)
            })
            .await
    }

    pub async fn find_service(
        &self,
        service_sid: &str,
    ) -> Result<Option<VerifyServiceRecord>, StoreError> {
        let service_sid = service_sid.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {SERVICE_COLUMNS} FROM verify_services WHERE sid = ?1"),
                        [service_sid],
                        read_service_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Stores a new service, or saves the editable fields of an existing one.
    pub async fn save_service(&self, service: VerifyServiceRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT INTO verify_services ({SERVICE_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) \
                     ON CONFLICT (sid) DO UPDATE SET friendly_name = excluded.friendly_name, code_length = excluded.code_length, fixed_code = excluded.fixed_code, ttl_seconds = excluded.ttl_seconds"),
                    params![
                        service.service_sid,
                        service.friendly_name,
                        service.code_length,
                        service.fixed_code,
                        service.ttl_seconds,
                        service.created_by,
                        service.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn delete_service(&self, service_sid: &str) -> Result<bool, StoreError> {
        let service_sid = service_sid.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection
                    .execute("DELETE FROM verify_services WHERE sid = ?1", [service_sid])?
                    > 0)
            })
            .await
    }
}

fn read_service_row(row: &Row<'_>) -> rusqlite::Result<VerifyServiceRecord> {
    Ok(VerifyServiceRecord {
        service_sid: row.get(0)?,
        friendly_name: row.get(1)?,
        code_length: row.get(2)?,
        fixed_code: row.get(3)?,
        ttl_seconds: row.get(4)?,
        created_by: row.get(5)?,
        created_at_unix_ms: row.get(6)?,
    })
}
