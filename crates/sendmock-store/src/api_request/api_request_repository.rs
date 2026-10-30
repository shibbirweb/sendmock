use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::{ApiRequestFilter, ApiRequestPage, ApiRequestRecord};
use crate::{Database, StoreError};

const REQUEST_COLUMNS: &str = "id, api, method, path, request_headers, request_body, response_status, response_body, \
     duration_ms, linked_message_kind, linked_message_id, created_at";

/// Filters shared by the count and the page; `?1` to `?3` are the filter values.
const FILTER_CONDITIONS: &str = "(?1 IS NULL OR api = ?1) \
     AND (?2 IS NULL OR response_status / 100 = ?2) \
     AND (?3 IS NULL OR instr(lower(path), lower(?3)) > 0)";

/// Every API request log query.
#[derive(Clone)]
pub struct ApiRequestRepository {
    database: Arc<Database>,
}

impl ApiRequestRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn insert_request(&self, request: ApiRequestRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                let (linked_message_kind, linked_message_id) = request.linked_message.unzip();
                connection.execute(
                    &format!("INSERT INTO api_requests ({REQUEST_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"),
                    params![
                        request.request_id,
                        request.api,
                        request.method,
                        request.path,
                        serde_json::to_string(&request.request_headers).unwrap_or_else(|_| "{}".to_owned()),
                        request.request_body,
                        request.response_status,
                        request.response_body,
                        i64::try_from(request.duration_ms).unwrap_or(i64::MAX),
                        linked_message_kind,
                        linked_message_id,
                        request.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn find_request(
        &self,
        request_id: &str,
    ) -> Result<Option<ApiRequestRecord>, StoreError> {
        let request_id = request_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {REQUEST_COLUMNS} FROM api_requests WHERE id = ?1"),
                        [request_id],
                        read_request_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Newest first; `cursor` is the id of the last request of the previous page.
    pub async fn list_requests(
        &self,
        filter: ApiRequestFilter,
        cursor: Option<String>,
        limit: u32,
    ) -> Result<ApiRequestPage, StoreError> {
        self.database
            .read(move |connection| {
                let filter_values = params![filter.api, filter.status_hundreds, filter.path_contains];
                let total_count: i64 = connection.query_row(
                    &format!("SELECT count(*) FROM api_requests WHERE {FILTER_CONDITIONS}"),
                    filter_values,
                    |row| row.get(0),
                )?;
                let mut statement = connection.prepare(&format!(
                    "SELECT {REQUEST_COLUMNS} FROM api_requests WHERE {FILTER_CONDITIONS} AND (?4 IS NULL OR id < ?4) ORDER BY id DESC LIMIT ?5"
                ))?;
                let mut requests = statement
                    .query_map(
                        params![filter.api, filter.status_hundreds, filter.path_contains, cursor, i64::from(limit) + 1],
                        read_request_row,
                    )?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                let has_more = requests.len() > limit as usize;
                requests.truncate(limit as usize);
                Ok(ApiRequestPage {
                    next_cursor: has_more.then(|| requests.last().map(|request| request.request_id.clone())).flatten(),
                    requests,
                    total_count: u64::try_from(total_count).unwrap_or_default(),
                })
            })
            .await
    }

    /// Keeps the newest `max_count` requests and drops those made before the cutoff.
    pub async fn prune_requests(
        &self,
        max_count: u64,
        created_before_unix_ms: Option<i64>,
    ) -> Result<u64, StoreError> {
        self.database
            .write(move |connection| {
                let kept_count = i64::try_from(max_count).unwrap_or(i64::MAX);
                let mut deleted_count = connection.execute(
                    "DELETE FROM api_requests WHERE id IN (SELECT id FROM api_requests ORDER BY id DESC LIMIT -1 OFFSET ?1)",
                    [kept_count],
                )?;
                if let Some(created_before_unix_ms) = created_before_unix_ms {
                    deleted_count += connection.execute("DELETE FROM api_requests WHERE created_at < ?1", [created_before_unix_ms])?;
                }
                Ok(deleted_count as u64)
            })
            .await
    }

    pub async fn delete_all_requests(&self) -> Result<u64, StoreError> {
        self.database
            .write(|connection| Ok(connection.execute("DELETE FROM api_requests", [])? as u64))
            .await
    }
}

fn read_request_row(row: &Row<'_>) -> rusqlite::Result<ApiRequestRecord> {
    let request_headers_json: String = row.get(4)?;
    let linked_message_kind: Option<String> = row.get(9)?;
    let linked_message_id: Option<String> = row.get(10)?;
    let duration_ms: i64 = row.get(8)?;
    Ok(ApiRequestRecord {
        request_id: row.get(0)?,
        api: row.get(1)?,
        method: row.get(2)?,
        path: row.get(3)?,
        request_headers: serde_json::from_str(&request_headers_json).unwrap_or_default(),
        request_body: row.get(5)?,
        response_status: row.get(6)?,
        response_body: row.get(7)?,
        duration_ms: u64::try_from(duration_ms).unwrap_or_default(),
        linked_message: linked_message_kind.zip(linked_message_id),
        created_at_unix_ms: row.get(11)?,
    })
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;
    use crate::{DatabaseLocation, EMBEDDED_MIGRATIONS};

    fn repository() -> ApiRequestRepository {
        let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
            .unwrap_or_else(|open_error| panic!("{open_error}"));
        ApiRequestRepository::new(Arc::new(database))
    }

    fn request(request_id: &str, api: &str, path: &str, response_status: u16) -> ApiRequestRecord {
        ApiRequestRecord {
            request_id: request_id.to_owned(),
            api: api.to_owned(),
            method: "POST".to_owned(),
            path: path.to_owned(),
            request_headers: BTreeMap::from([(
                "authorization".to_owned(),
                "Basic ****".to_owned(),
            )]),
            request_body: "{}".to_owned(),
            response_status,
            response_body: "{}".to_owned(),
            duration_ms: 3,
            linked_message: (response_status < 300)
                .then(|| ("email".to_owned(), format!("email-{request_id}"))),
            created_at_unix_ms: 1,
        }
    }

    #[tokio::test]
    async fn stores_and_finds_a_request_as_it_was() -> Result<(), StoreError> {
        let repository = repository();
        let stored_request = request("01A", "native", "/api/v1/send", 201);

        repository.insert_request(stored_request.clone()).await?;

        assert_eq!(repository.find_request("01A").await?, Some(stored_request));
        Ok(())
    }

    // AC: SM-13.3
    #[tokio::test]
    async fn filters_by_api_status_class_and_path() -> Result<(), StoreError> {
        let repository = repository();
        repository
            .insert_request(request("01A", "native", "/api/v1/send", 201))
            .await?;
        repository
            .insert_request(request("01B", "native", "/api/v1/send/raw", 400))
            .await?;
        repository
            .insert_request(request("01C", "twilio", "/2010-04-01/Messages.json", 201))
            .await?;

        let rejected = repository
            .list_requests(
                ApiRequestFilter {
                    status_hundreds: Some(4),
                    ..ApiRequestFilter::default()
                },
                None,
                50,
            )
            .await?;
        let native_raw = repository
            .list_requests(
                ApiRequestFilter {
                    api: Some("native".to_owned()),
                    path_contains: Some("RAW".to_owned()),
                    ..ApiRequestFilter::default()
                },
                None,
                50,
            )
            .await?;

        assert_eq!(rejected.requests.len(), 1);
        assert_eq!(rejected.requests[0].request_id, "01B");
        assert_eq!(native_raw.total_count, 1);
        Ok(())
    }

    #[tokio::test]
    async fn pages_newest_first() -> Result<(), StoreError> {
        let repository = repository();
        for request_id in ["01A", "01B", "01C"] {
            repository
                .insert_request(request(request_id, "native", "/api/v1/send", 201))
                .await?;
        }

        let first_page = repository
            .list_requests(ApiRequestFilter::default(), None, 2)
            .await?;
        let second_page = repository
            .list_requests(
                ApiRequestFilter::default(),
                first_page.next_cursor.clone(),
                2,
            )
            .await?;

        assert_eq!(
            first_page
                .requests
                .iter()
                .map(|request| request.request_id.as_str())
                .collect::<Vec<_>>(),
            ["01C", "01B"]
        );
        assert_eq!(second_page.requests[0].request_id, "01A");
        assert_eq!(second_page.next_cursor, None);
        assert_eq!(first_page.total_count, 3);
        Ok(())
    }
}
