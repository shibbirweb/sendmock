use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::VirtualNumberRecord;
use crate::{Database, StoreError};

const NUMBER_COLUMNS: &str = "id, number, label, channels, inbound_url, inbound_method, inbound_fallback_url, inbound_template_id, status_callback_url, messaging_service_sid, created_by, created_at";
const CHANNEL_SEPARATOR: &str = ",";

#[derive(Clone)]
pub struct VirtualNumberRepository {
    database: Arc<Database>,
}

impl VirtualNumberRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn list_numbers(&self) -> Result<Vec<VirtualNumberRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {NUMBER_COLUMNS} FROM virtual_numbers ORDER BY created_at, rowid"
                ))?;
                Ok(statement
                    .query_map([], read_number_row)?
                    .collect::<rusqlite::Result<_>>()?)
            })
            .await
    }

    pub async fn find_number(
        &self,
        number_id: &str,
    ) -> Result<Option<VirtualNumberRecord>, StoreError> {
        self.find_where("id", number_id).await
    }

    /// The registered number with this E.164 value, if any.
    pub async fn find_by_number(
        &self,
        e164_number: &str,
    ) -> Result<Option<VirtualNumberRecord>, StoreError> {
        self.find_where("number", e164_number).await
    }

    async fn find_where(
        &self,
        column_name: &'static str,
        column_value: &str,
    ) -> Result<Option<VirtualNumberRecord>, StoreError> {
        let column_value = column_value.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!(
                            "SELECT {NUMBER_COLUMNS} FROM virtual_numbers WHERE {column_name} = ?1"
                        ),
                        [column_value],
                        read_number_row,
                    )
                    .optional()?)
            })
            .await
    }

    pub async fn insert_number(&self, new_number: VirtualNumberRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT INTO virtual_numbers ({NUMBER_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"),
                    params![
                        new_number.number_id,
                        new_number.number,
                        new_number.label,
                        new_number.channels.join(CHANNEL_SEPARATOR),
                        new_number.inbound_url,
                        new_number.inbound_method,
                        new_number.inbound_fallback_url,
                        new_number.inbound_template_id,
                        new_number.status_callback_url,
                        new_number.messaging_service_sid,
                        new_number.created_by,
                        new_number.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    /// Saves every editable field, the service included; false when the number is gone.
    pub async fn update_number(
        &self,
        changed_number: VirtualNumberRecord,
    ) -> Result<bool, StoreError> {
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE virtual_numbers SET number = ?2, label = ?3, channels = ?4, inbound_url = ?5, inbound_method = ?6, inbound_fallback_url = ?7, inbound_template_id = ?8, status_callback_url = ?9, messaging_service_sid = ?10 WHERE id = ?1",
                    params![
                        changed_number.number_id,
                        changed_number.number,
                        changed_number.label,
                        changed_number.channels.join(CHANNEL_SEPARATOR),
                        changed_number.inbound_url,
                        changed_number.inbound_method,
                        changed_number.inbound_fallback_url,
                        changed_number.inbound_template_id,
                        changed_number.status_callback_url,
                        changed_number.messaging_service_sid,
                    ],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    pub async fn delete_number(&self, number_id: &str) -> Result<bool, StoreError> {
        let number_id = number_id.to_owned();
        self.database
            .write(move |connection| {
                Ok(
                    connection.execute("DELETE FROM virtual_numbers WHERE id = ?1", [number_id])?
                        > 0,
                )
            })
            .await
    }
}

fn read_number_row(row: &Row<'_>) -> rusqlite::Result<VirtualNumberRecord> {
    let channels_text: String = row.get(3)?;
    Ok(VirtualNumberRecord {
        number_id: row.get(0)?,
        number: row.get(1)?,
        label: row.get(2)?,
        channels: channels_text
            .split(CHANNEL_SEPARATOR)
            .filter(|channel| !channel.is_empty())
            .map(str::to_owned)
            .collect(),
        inbound_url: row.get(4)?,
        inbound_method: row.get(5)?,
        inbound_fallback_url: row.get(6)?,
        inbound_template_id: row.get(7)?,
        status_callback_url: row.get(8)?,
        messaging_service_sid: row.get(9)?,
        created_by: row.get(10)?,
        created_at_unix_ms: row.get(11)?,
    })
}
