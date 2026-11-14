use std::sync::Arc;

use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, OptionalExtension, Row, params, params_from_iter};

use super::{PushNotificationFilter, PushNotificationPage, PushNotificationRecord};
use crate::{Database, StoreError};

const PUSH_COLUMNS: &str = "id, provider, provider_message_id, device_token, platform, title, body, \
     image_url, data_json, status, error_reason, request_json, response_status, response_json, \
     project_key, created_at";

fn read_push_row(row: &Row<'_>) -> rusqlite::Result<PushNotificationRecord> {
    Ok(PushNotificationRecord {
        push_id: row.get(0)?,
        provider: row.get(1)?,
        provider_message_id: row.get(2)?,
        device_token: row.get(3)?,
        platform: row.get(4)?,
        title: row.get(5)?,
        body: row.get(6)?,
        image_url: row.get(7)?,
        data_json: row.get(8)?,
        status: row.get(9)?,
        error_reason: row.get(10)?,
        request_json: row.get(11)?,
        response_status: row.get(12)?,
        response_json: row.get(13)?,
        project_key: row.get(14)?,
        created_at_unix_ms: row.get(15)?,
    })
}

/// The filter's conditions joined with AND, with their parameters in the same order.
fn build_conditions(filter: &PushNotificationFilter) -> (String, Vec<SqlValue>) {
    let mut conditions = vec!["1 = 1"];
    let mut parameters = Vec::new();
    for (condition, filter_value) in [
        ("project_key = ?", &filter.project_key),
        ("device_token = ?", &filter.device_token),
        ("provider = ?", &filter.provider),
        ("status = ?", &filter.status),
    ] {
        if let Some(filter_value) = filter_value {
            conditions.push(condition);
            parameters.push(SqlValue::Text(filter_value.clone()));
        }
    }
    if let Some(created_after_unix_ms) = filter.created_after_unix_ms {
        conditions.push("created_at > ?");
        parameters.push(SqlValue::Integer(created_after_unix_ms));
    }
    (conditions.join(" AND "), parameters)
}

/// Newest first; `cursor` is the id of the last notification of the previous page.
fn select_page(
    connection: &Connection,
    filter: &PushNotificationFilter,
    cursor: Option<&str>,
    limit: u32,
) -> rusqlite::Result<PushNotificationPage> {
    let (conditions, parameters) = build_conditions(filter);
    let total_count: i64 = connection.query_row(
        &format!("SELECT COUNT(*) FROM push_notifications WHERE {conditions}"),
        params_from_iter(parameters.iter()),
        |row| row.get(0),
    )?;
    let mut page_parameters = parameters;
    let cursor_condition = match cursor {
        Some(cursor) => {
            page_parameters.push(SqlValue::Text(cursor.to_owned()));
            " AND id < ?"
        }
        None => "",
    };
    page_parameters.push(SqlValue::Integer(i64::from(limit) + 1));
    let mut statement = connection.prepare(&format!(
        "SELECT {PUSH_COLUMNS} FROM push_notifications WHERE {conditions}{cursor_condition} ORDER BY id DESC LIMIT ?"
    ))?;
    let mut notifications = statement
        .query_map(params_from_iter(page_parameters.iter()), read_push_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let has_more = notifications.len() > limit as usize;
    notifications.truncate(limit as usize);
    Ok(PushNotificationPage {
        next_cursor: has_more
            .then(|| {
                notifications
                    .last()
                    .map(|notification| notification.push_id.clone())
            })
            .flatten(),
        notifications,
        total_count: u64::try_from(total_count).unwrap_or_default(),
    })
}

/// Push notifications, newest first.
#[derive(Clone)]
pub struct PushNotificationRepository {
    database: Arc<Database>,
}

impl PushNotificationRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn insert_notification(
        &self,
        notification: PushNotificationRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT INTO push_notifications ({PUSH_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)"),
                    params![
                        notification.push_id,
                        notification.provider,
                        notification.provider_message_id,
                        notification.device_token,
                        notification.platform,
                        notification.title,
                        notification.body,
                        notification.image_url,
                        notification.data_json,
                        notification.status,
                        notification.error_reason,
                        notification.request_json,
                        notification.response_status,
                        notification.response_json,
                        notification.project_key,
                        notification.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn find_notification(
        &self,
        push_id: &str,
    ) -> Result<Option<PushNotificationRecord>, StoreError> {
        let push_id = push_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {PUSH_COLUMNS} FROM push_notifications WHERE id = ?1"),
                        [push_id],
                        read_push_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// The notification whose provider answered this id, such as an Expo ticket id.
    pub async fn find_by_provider_message_id(
        &self,
        provider: &str,
        provider_message_id: &str,
    ) -> Result<Option<PushNotificationRecord>, StoreError> {
        let (provider, provider_message_id) = (provider.to_owned(), provider_message_id.to_owned());
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {PUSH_COLUMNS} FROM push_notifications WHERE provider = ?1 AND provider_message_id = ?2"),
                        [provider, provider_message_id],
                        read_push_row,
                    )
                    .optional()?)
            })
            .await
    }

    pub async fn list_notifications(
        &self,
        filter: PushNotificationFilter,
        cursor: Option<String>,
        limit: u32,
    ) -> Result<PushNotificationPage, StoreError> {
        self.database
            .read(move |connection| Ok(select_page(connection, &filter, cursor.as_deref(), limit)?))
            .await
    }

    /// Answers whether the notification existed.
    pub async fn delete_notification(&self, push_id: &str) -> Result<bool, StoreError> {
        let push_id = push_id.to_owned();
        self.database
            .write(move |connection| {
                Ok(
                    connection
                        .execute("DELETE FROM push_notifications WHERE id = ?1", [push_id])?
                        > 0,
                )
            })
            .await
    }

    /// Deletes every notification, or one project's; answers how many went.
    pub async fn delete_notifications(
        &self,
        project_key: Option<String>,
    ) -> Result<u64, StoreError> {
        self.database
            .write(move |connection| {
                let deleted_count = connection.execute(
                    "DELETE FROM push_notifications WHERE ?1 IS NULL OR project_key = ?1",
                    [project_key],
                )?;
                Ok(u64::try_from(deleted_count).unwrap_or_default())
            })
            .await
    }
}
