use std::sync::Arc;

use rusqlite::{Connection, OptionalExtension, params};

use super::delivery_list_query::{DELIVERY_COLUMNS, list_deliveries, read_delivery_row};
use super::{
    DeliveryAttemptResult, WebhookDeliveryFilter, WebhookDeliveryPage, WebhookDeliveryRecord,
};
use crate::{Database, StoreError};

/// Rows that are due: a `pending` send or a `failed` attempt's retry.
const DUE_CONDITION: &str =
    "status IN ('pending', 'failed') AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?1";

/// Webhook delivery attempts; the rows double as the persistent delivery queue.
#[derive(Clone)]
pub struct WebhookDeliveryRepository {
    database: Arc<Database>,
}

impl WebhookDeliveryRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn insert_delivery(
        &self,
        new_delivery: WebhookDeliveryRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| Ok(insert_delivery_row(connection, &new_delivery)?))
            .await
    }

    pub async fn find_delivery(
        &self,
        delivery_id: &str,
    ) -> Result<Option<WebhookDeliveryRecord>, StoreError> {
        let delivery_id = delivery_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {DELIVERY_COLUMNS} FROM webhook_deliveries WHERE id = ?1"),
                        [delivery_id],
                        read_delivery_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Newest first, `limit` at a time after `cursor`.
    pub async fn list_deliveries(
        &self,
        filter: WebhookDeliveryFilter,
        cursor: Option<String>,
        limit: u32,
    ) -> Result<WebhookDeliveryPage, StoreError> {
        self.database
            .read(move |connection| {
                Ok(list_deliveries(
                    connection,
                    &filter,
                    cursor.as_deref(),
                    limit,
                )?)
            })
            .await
    }

    /// Every attempt of one event to one endpoint, oldest first.
    pub async fn list_event_attempts(
        &self,
        event_id: &str,
        endpoint_id: &str,
    ) -> Result<Vec<WebhookDeliveryRecord>, StoreError> {
        let (event_id, endpoint_id) = (event_id.to_owned(), endpoint_id.to_owned());
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {DELIVERY_COLUMNS} FROM webhook_deliveries WHERE event_id = ?1 AND endpoint_id = ?2 ORDER BY attempt, id"
                ))?;
                let attempts = statement
                    .query_map([event_id, endpoint_id], read_delivery_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(attempts)
            })
            .await
    }

    /// Rows due at `now_unix_ms`, the longest waiting first, then in the order they were queued.
    pub async fn list_due_deliveries(
        &self,
        now_unix_ms: i64,
        limit: u32,
    ) -> Result<Vec<WebhookDeliveryRecord>, StoreError> {
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {DELIVERY_COLUMNS} FROM webhook_deliveries WHERE {DUE_CONDITION} ORDER BY next_attempt_at, rowid LIMIT ?2"
                ))?;
                let due_deliveries = statement
                    .query_map(params![now_unix_ms, limit], read_delivery_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(due_deliveries)
            })
            .await
    }

    /// When the next row comes due; none when nothing waits.
    pub async fn find_next_due_time(&self) -> Result<Option<i64>, StoreError> {
        self.database
            .read(|connection| {
                Ok(connection.query_row(
                    "SELECT min(next_attempt_at) FROM webhook_deliveries WHERE status IN ('pending', 'failed')",
                    [],
                    |row| row.get(0),
                )?)
            })
            .await
    }

    /// Claims a `pending` row for sending; false when it was claimed or cancelled meanwhile.
    pub async fn start_pending_attempt(&self, delivery_id: &str) -> Result<bool, StoreError> {
        let delivery_id = delivery_id.to_owned();
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE webhook_deliveries SET status = 'in_flight', next_attempt_at = NULL WHERE id = ?1 AND status = 'pending'",
                    [delivery_id],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    /// Claims a `failed` row's retry and inserts the next attempt's row, already `in_flight`;
    /// false when the retry was claimed or cancelled meanwhile.
    pub async fn start_retry_attempt(
        &self,
        failed_delivery_id: &str,
        retry_delivery: WebhookDeliveryRecord,
    ) -> Result<bool, StoreError> {
        let failed_delivery_id = failed_delivery_id.to_owned();
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let claimed_count = transaction.execute(
                    "UPDATE webhook_deliveries SET next_attempt_at = NULL WHERE id = ?1 AND status = 'failed' AND next_attempt_at IS NOT NULL",
                    [failed_delivery_id],
                )?;
                if claimed_count > 0 {
                    insert_delivery_row(&transaction, &retry_delivery)?;
                }
                transaction.commit()?;
                Ok(claimed_count > 0)
            })
            .await
    }

    /// Records how an `in_flight` attempt ended; false when the row is not in flight.
    pub async fn finish_attempt(
        &self,
        delivery_id: &str,
        attempt_result: DeliveryAttemptResult,
    ) -> Result<bool, StoreError> {
        let delivery_id = delivery_id.to_owned();
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE webhook_deliveries SET status = ?2, sent_request = ?3, response = ?4, duration_ms = ?5, error_message = ?6, next_attempt_at = ?7 WHERE id = ?1 AND status = 'in_flight'",
                    params![
                        delivery_id,
                        attempt_result.status,
                        attempt_result.sent_request_json,
                        attempt_result.response_json,
                        attempt_result.duration_ms,
                        attempt_result.error_message,
                        attempt_result.next_attempt_at_unix_ms,
                    ],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    /// Cancels a row that has not been sent or still has a retry due; false otherwise.
    pub async fn cancel_delivery(&self, delivery_id: &str) -> Result<bool, StoreError> {
        let delivery_id = delivery_id.to_owned();
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE webhook_deliveries SET status = 'cancelled', next_attempt_at = NULL WHERE id = ?1 AND (status = 'pending' OR (status = 'failed' AND next_attempt_at IS NOT NULL))",
                    [delivery_id],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    /// Puts rows a stopped process left `in_flight` back in the queue, due at `now_unix_ms`.
    pub async fn requeue_in_flight(&self, now_unix_ms: i64) -> Result<usize, StoreError> {
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "UPDATE webhook_deliveries SET status = 'pending', next_attempt_at = ?1 WHERE status = 'in_flight'",
                    [now_unix_ms],
                )?)
            })
            .await
    }
}

fn insert_delivery_row(
    connection: &Connection,
    delivery: &WebhookDeliveryRecord,
) -> rusqlite::Result<()> {
    connection.execute(
        &format!("INSERT INTO webhook_deliveries ({DELIVERY_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)"),
        params![
            delivery.delivery_id,
            delivery.endpoint_id,
            delivery.endpoint_name,
            delivery.rule_id,
            delivery.event_id,
            delivery.event_type,
            delivery.subject_id,
            delivery.trigger,
            delivery.attempt,
            delivery.status,
            delivery.retry_policy_json,
            delivery.rendered_request_json,
            delivery.sent_request_json,
            delivery.response_json,
            delivery.duration_ms,
            delivery.error_message,
            delivery.next_attempt_at_unix_ms,
            delivery.created_at_unix_ms,
            delivery.event_json,
        ],
    )?;
    Ok(())
}
