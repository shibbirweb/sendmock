use std::sync::Arc;

use rusqlite::{Connection, OptionalExtension, Row, params};

use super::{CapturedFileRecord, CapturedRequestRecord};
use crate::{Database, StoreError};

const REQUEST_SELECT: &str = "SELECT r.id, r.bin_id, b.name, r.method, r.url, r.path, r.query_json, r.headers_json, r.body, \
     r.content_type, r.client_ip, r.response_status, r.response_headers_json, r.response_body, r.matched_rule_id, \
     r.matched_rule_name, r.is_simulated_failure, r.duration_ms, r.created_at \
     FROM http_captured_requests r JOIN http_bins b ON b.id = r.bin_id";

fn read_request_row(row: &Row<'_>) -> rusqlite::Result<CapturedRequestRecord> {
    Ok(CapturedRequestRecord {
        request_id: row.get(0)?,
        bin_id: row.get(1)?,
        bin_name: row.get(2)?,
        method: row.get(3)?,
        url: row.get(4)?,
        path: row.get(5)?,
        query_json: row.get(6)?,
        headers_json: row.get(7)?,
        body: row.get(8)?,
        content_type: row.get(9)?,
        client_ip: row.get(10)?,
        response_status: row.get(11)?,
        response_headers_json: row.get(12)?,
        response_body: row.get(13)?,
        matched_rule_id: row.get(14)?,
        matched_rule_name: row.get(15)?,
        is_simulated_failure: row.get(16)?,
        duration_ms: row.get(17)?,
        created_at_unix_ms: row.get(18)?,
        files: Vec::new(),
    })
}

/// The files of a request, without their bytes.
fn select_file_list(
    connection: &Connection,
    request_id: &str,
) -> rusqlite::Result<Vec<CapturedFileRecord>> {
    let mut statement = connection.prepare(
        "SELECT file_index, field_name, filename, content_type, length(content) FROM http_captured_files WHERE request_id = ?1 ORDER BY file_index",
    )?;
    statement
        .query_map([request_id], |row| {
            Ok(CapturedFileRecord {
                file_index: row.get(0)?,
                field_name: row.get(1)?,
                filename: row.get(2)?,
                content_type: row.get(3)?,
                size_bytes: u64::try_from(row.get::<_, i64>(4)?).unwrap_or_default(),
                content: Vec::new(),
            })
        })?
        .collect()
}

fn insert_request_rows(
    connection: &Connection,
    request: &CapturedRequestRecord,
) -> rusqlite::Result<()> {
    connection.execute(
        "INSERT INTO http_captured_requests (id, bin_id, method, url, path, query_json, headers_json, body, content_type, client_ip, \
         response_status, response_headers_json, response_body, matched_rule_id, matched_rule_name, is_simulated_failure, duration_ms, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        params![
            request.request_id, request.bin_id, request.method, request.url, request.path, request.query_json,
            request.headers_json, request.body, request.content_type, request.client_ip, request.response_status,
            request.response_headers_json, request.response_body, request.matched_rule_id, request.matched_rule_name,
            request.is_simulated_failure, request.duration_ms, request.created_at_unix_ms,
        ],
    )?;
    for captured_file in &request.files {
        connection.execute(
            "INSERT INTO http_captured_files (request_id, file_index, field_name, filename, content_type, content) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                request.request_id, captured_file.file_index, captured_file.field_name,
                captured_file.filename, captured_file.content_type, captured_file.content,
            ],
        )?;
    }
    Ok(())
}

/// Captured requests, read newest first.
#[derive(Clone)]
pub struct CapturedRequestRepository {
    database: Arc<Database>,
}

impl CapturedRequestRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn insert_request(&self, request: CapturedRequestRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                insert_request_rows(&transaction, &request)?;
                transaction.commit()?;
                Ok(())
            })
            .await
    }

    /// One page newest first, optionally one bin's and older than a request id.
    pub async fn list_requests(
        &self,
        bin_id: Option<String>,
        before_request_id: Option<String>,
        limit: u32,
    ) -> Result<Vec<CapturedRequestRecord>, StoreError> {
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(&format!(
                    "{REQUEST_SELECT} WHERE (?1 IS NULL OR r.bin_id = ?1) AND (?2 IS NULL OR r.id < ?2) ORDER BY r.created_at DESC, r.id DESC LIMIT ?3"
                ))?;
                let mut requests = statement
                    .query_map(params![bin_id, before_request_id, limit], read_request_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                for request in &mut requests {
                    request.files = select_file_list(connection, &request.request_id)?;
                }
                Ok(requests)
            })
            .await
    }

    pub async fn find_request(
        &self,
        request_id: &str,
    ) -> Result<Option<CapturedRequestRecord>, StoreError> {
        let request_id = request_id.to_owned();
        self.database
            .read(move |connection| {
                let Some(mut request) = connection
                    .query_row(
                        &format!("{REQUEST_SELECT} WHERE r.id = ?1"),
                        [&request_id],
                        read_request_row,
                    )
                    .optional()?
                else {
                    return Ok(None);
                };
                request.files = select_file_list(connection, &request_id)?;
                Ok(Some(request))
            })
            .await
    }

    pub async fn read_file(
        &self,
        request_id: &str,
        file_index: u32,
    ) -> Result<Option<CapturedFileRecord>, StoreError> {
        let request_id = request_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        "SELECT file_index, field_name, filename, content_type, content FROM http_captured_files WHERE request_id = ?1 AND file_index = ?2",
                        params![request_id, file_index],
                        |row| {
                            let content: Vec<u8> = row.get(4)?;
                            Ok(CapturedFileRecord {
                                file_index: row.get(0)?,
                                field_name: row.get(1)?,
                                filename: row.get(2)?,
                                content_type: row.get(3)?,
                                size_bytes: u64::try_from(content.len()).unwrap_or_default(),
                                content,
                            })
                        },
                    )
                    .optional()?)
            })
            .await
    }

    /// How many requests are stored, or one bin's.
    pub async fn count_requests(&self, bin_id: Option<String>) -> Result<u64, StoreError> {
        self.database
            .read(move |connection| {
                let request_count: i64 = connection.query_row(
                    "SELECT COUNT(*) FROM http_captured_requests WHERE ?1 IS NULL OR bin_id = ?1",
                    [&bin_id],
                    |row| row.get(0),
                )?;
                Ok(u64::try_from(request_count).unwrap_or_default())
            })
            .await
    }

    /// Deletes every captured request, or one bin's; answers how many.
    pub async fn delete_requests(&self, bin_id: Option<String>) -> Result<usize, StoreError> {
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                transaction.execute(
                    "DELETE FROM http_captured_files WHERE request_id IN (SELECT id FROM http_captured_requests WHERE ?1 IS NULL OR bin_id = ?1)",
                    [&bin_id],
                )?;
                let deleted_count = transaction.execute(
                    "DELETE FROM http_captured_requests WHERE ?1 IS NULL OR bin_id = ?1",
                    [&bin_id],
                )?;
                transaction.commit()?;
                Ok(deleted_count)
            })
            .await
    }
}
