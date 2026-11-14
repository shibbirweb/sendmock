use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::HttpBinRecord;
use crate::{Database, StoreError};

/// The bin columns, with the request count and the newest request read alongside.
const BIN_SELECT: &str = "SELECT b.id, b.name, b.preset, b.default_response_json, b.rules_json, b.created_at, \
     (SELECT COUNT(*) FROM http_captured_requests r WHERE r.bin_id = b.id), \
     (SELECT MAX(r.created_at) FROM http_captured_requests r WHERE r.bin_id = b.id) \
     FROM http_bins b";

fn read_bin_row(row: &Row<'_>) -> rusqlite::Result<HttpBinRecord> {
    Ok(HttpBinRecord {
        bin_id: row.get(0)?,
        name: row.get(1)?,
        preset: row.get(2)?,
        default_response_json: row.get(3)?,
        rules_json: row.get(4)?,
        created_at_unix_ms: row.get(5)?,
        request_count: u64::try_from(row.get::<_, i64>(6)?).unwrap_or_default(),
        last_request_at_unix_ms: row.get(7)?,
    })
}

/// HTTP catcher bins.
#[derive(Clone)]
pub struct HttpBinRepository {
    database: Arc<Database>,
}

impl HttpBinRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn list_bins(&self) -> Result<Vec<HttpBinRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement =
                    connection.prepare(&format!("{BIN_SELECT} ORDER BY b.created_at, b.rowid"))?;
                let bins = statement
                    .query_map([], read_bin_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(bins)
            })
            .await
    }

    async fn find_bin_where(
        &self,
        condition: &'static str,
        value: String,
    ) -> Result<Option<HttpBinRecord>, StoreError> {
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("{BIN_SELECT} WHERE {condition} = ?1"),
                        [value],
                        read_bin_row,
                    )
                    .optional()?)
            })
            .await
    }

    pub async fn find_bin(&self, bin_id: &str) -> Result<Option<HttpBinRecord>, StoreError> {
        self.find_bin_where("b.id", bin_id.to_owned()).await
    }

    pub async fn find_bin_by_name(
        &self,
        bin_name: &str,
    ) -> Result<Option<HttpBinRecord>, StoreError> {
        self.find_bin_where("b.name", bin_name.to_owned()).await
    }

    /// Adds the bin unless one with its name exists; answers the stored bin either way.
    pub async fn insert_bin_once(
        &self,
        new_bin: HttpBinRecord,
    ) -> Result<HttpBinRecord, StoreError> {
        let bin_name = new_bin.name.clone();
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT OR IGNORE INTO http_bins (id, name, preset, default_response_json, rules_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        new_bin.bin_id,
                        new_bin.name,
                        new_bin.preset,
                        new_bin.default_response_json,
                        new_bin.rules_json,
                        new_bin.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await?;
        self.find_bin_by_name(&bin_name)
            .await?
            .ok_or(StoreError::Sqlite(rusqlite::Error::QueryReturnedNoRows))
    }

    /// Saves the default reply and the rules; false when the bin is gone.
    pub async fn update_bin_answers(
        &self,
        bin_id: &str,
        default_response_json: String,
        rules_json: String,
    ) -> Result<bool, StoreError> {
        let bin_id = bin_id.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "UPDATE http_bins SET default_response_json = ?2, rules_json = ?3 WHERE id = ?1",
                    params![bin_id, default_response_json, rules_json],
                )? > 0)
            })
            .await
    }

    /// Deletes the bin with its requests and their files.
    pub async fn delete_bin(&self, bin_id: &str) -> Result<bool, StoreError> {
        let bin_id = bin_id.to_owned();
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                transaction.execute(
                    "DELETE FROM http_captured_files WHERE request_id IN (SELECT id FROM http_captured_requests WHERE bin_id = ?1)",
                    [&bin_id],
                )?;
                transaction.execute("DELETE FROM http_captured_requests WHERE bin_id = ?1", [&bin_id])?;
                let deleted_count = transaction.execute("DELETE FROM http_bins WHERE id = ?1", [&bin_id])?;
                transaction.commit()?;
                Ok(deleted_count > 0)
            })
            .await
    }
}
