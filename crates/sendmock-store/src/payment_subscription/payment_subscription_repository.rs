use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use crate::{Database, StoreError};

/// A subscription as stored; the document is the operations' JSON.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentSubscriptionRecord {
    pub subscription_id: String,
    pub document_json: String,
    pub created_at_unix_ms: i64,
}

/// Subscriptions, listed newest first.
#[derive(Clone)]
pub struct PaymentSubscriptionRepository {
    database: Arc<Database>,
}

fn read_subscription_row(row: &Row<'_>) -> rusqlite::Result<PaymentSubscriptionRecord> {
    Ok(PaymentSubscriptionRecord {
        subscription_id: row.get(0)?,
        document_json: row.get(1)?,
        created_at_unix_ms: row.get(2)?,
    })
}

impl PaymentSubscriptionRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn list_subscriptions(&self) -> Result<Vec<PaymentSubscriptionRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(
                    "SELECT id, document_json, created_at FROM payment_subscriptions ORDER BY created_at DESC, rowid DESC",
                )?;
                let subscriptions = statement
                    .query_map([], read_subscription_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(subscriptions)
            })
            .await
    }

    pub async fn find_subscription(
        &self,
        subscription_id: &str,
    ) -> Result<Option<PaymentSubscriptionRecord>, StoreError> {
        let subscription_id = subscription_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        "SELECT id, document_json, created_at FROM payment_subscriptions WHERE id = ?1",
                        [subscription_id],
                        read_subscription_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Inserts a new subscription or replaces the one with the same id.
    pub async fn save_subscription(
        &self,
        subscription: PaymentSubscriptionRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT OR REPLACE INTO payment_subscriptions (id, document_json, created_at) VALUES (?1, ?2, ?3)",
                    params![
                        subscription.subscription_id,
                        subscription.document_json,
                        subscription.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn delete_all_subscriptions(&self) -> Result<u64, StoreError> {
        self.database
            .write(|connection| {
                Ok(connection.execute("DELETE FROM payment_subscriptions", [])? as u64)
            })
            .await
    }
}
