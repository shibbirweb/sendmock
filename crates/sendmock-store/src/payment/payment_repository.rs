use std::sync::Arc;

use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, OptionalExtension, Row, params, params_from_iter};

use super::{PaymentListFilter, PaymentPage, PaymentRecord, PaymentTotalsRecord};
use crate::{Database, StoreError};

const PAYMENT_COLUMNS: &str =
    "id, provider, method_key, status, currency, document, created_at, updated_at";

/// Test payments.
#[derive(Clone)]
pub struct PaymentRepository {
    database: Arc<Database>,
}

fn read_payment_row(row: &Row<'_>) -> rusqlite::Result<PaymentRecord> {
    Ok(PaymentRecord {
        payment_id: row.get(0)?,
        provider: row.get(1)?,
        method_key: row.get(2)?,
        status: row.get(3)?,
        currency: row.get(4)?,
        document_json: row.get(5)?,
        created_at_unix_ms: row.get(6)?,
        updated_at_unix_ms: row.get(7)?,
    })
}

fn build_conditions(filter: &PaymentListFilter) -> (String, Vec<SqlValue>) {
    let mut conditions = vec!["1 = 1".to_owned()];
    let mut parameters = Vec::new();
    if !filter.statuses.is_empty() {
        let placeholders = vec!["?"; filter.statuses.len()].join(", ");
        conditions.push(format!("status IN ({placeholders})"));
        parameters.extend(filter.statuses.iter().cloned().map(SqlValue::Text));
    }
    for (column, value) in [
        ("provider", &filter.provider),
        ("currency", &filter.currency),
    ] {
        if let Some(value) = value {
            conditions.push(format!("{column} = ?"));
            parameters.push(SqlValue::Text(value.clone()));
        }
    }
    (conditions.join(" AND "), parameters)
}

fn list_payment_page(
    connection: &Connection,
    filter: &PaymentListFilter,
    cursor: Option<&str>,
    limit: u32,
) -> rusqlite::Result<PaymentPage> {
    let (conditions, parameters) = build_conditions(filter);
    let total_count: i64 = connection.query_row(
        &format!("SELECT count(*) FROM payments WHERE {conditions}"),
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
        "SELECT {PAYMENT_COLUMNS} FROM payments WHERE {conditions}{cursor_condition} ORDER BY id DESC LIMIT ?"
    ))?;
    let mut payments = statement
        .query_map(params_from_iter(page_parameters.iter()), read_payment_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let has_more = payments.len() > limit as usize;
    payments.truncate(limit as usize);
    Ok(PaymentPage {
        next_cursor: has_more
            .then(|| payments.last().map(|payment| payment.payment_id.clone()))
            .flatten(),
        payments,
        total_count: u64::try_from(total_count).unwrap_or_default(),
    })
}

fn count_rows(count: i64) -> u64 {
    u64::try_from(count).unwrap_or_default()
}

fn read_payment_totals_since(
    connection: &Connection,
    since_unix_ms: i64,
) -> rusqlite::Result<PaymentTotalsRecord> {
    let (payment_count, payments_since): (i64, i64) = connection.query_row(
        "SELECT count(*), coalesce(sum(created_at >= ?1), 0) FROM payments",
        [since_unix_ms],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let count_by_status = connection
        .prepare("SELECT status, count(*) FROM payments GROUP BY status ORDER BY status")?
        .query_map([], |row| Ok((row.get(0)?, count_rows(row.get(1)?))))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let net_minor_by_currency = connection
        .prepare(
            "SELECT currency, sum(net_minor) AS total_minor FROM (SELECT currency, \
             coalesce(json_extract(document, '$.captured_minor'), 0) \
             - coalesce(json_extract(document, '$.refunded_minor'), 0) AS net_minor FROM payments) \
             WHERE net_minor > 0 GROUP BY currency ORDER BY total_minor DESC, currency",
        )?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(PaymentTotalsRecord {
        payment_count: count_rows(payment_count),
        payments_since: count_rows(payments_since),
        count_by_status,
        net_minor_by_currency,
    })
}

impl PaymentRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Creates the payment, or replaces the stored one with the same id.
    pub async fn save_payment(&self, payment: PaymentRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT INTO payments ({PAYMENT_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) \
                     ON CONFLICT (id) DO UPDATE SET method_key = excluded.method_key, status = excluded.status, \
                     document = excluded.document, updated_at = excluded.updated_at"),
                    params![
                        payment.payment_id,
                        payment.provider,
                        payment.method_key,
                        payment.status,
                        payment.currency,
                        payment.document_json,
                        payment.created_at_unix_ms,
                        payment.updated_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn find_payment(
        &self,
        payment_id: &str,
    ) -> Result<Option<PaymentRecord>, StoreError> {
        let payment_id = payment_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {PAYMENT_COLUMNS} FROM payments WHERE id = ?1"),
                        [payment_id],
                        read_payment_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// The provider's payment that the provider knows by `provider_id`, e.g. a Stripe
    /// PaymentIntent's `pi_...`, read from the payment's `provider_ids`.
    pub async fn find_payment_by_provider_id(
        &self,
        provider: &str,
        provider_id: &str,
    ) -> Result<Option<PaymentRecord>, StoreError> {
        let query_values = [provider, provider_id].map(str::to_owned);
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!(
                            "SELECT {PAYMENT_COLUMNS} FROM payments WHERE provider = ?1 AND EXISTS \
                             (SELECT 1 FROM json_each(document, '$.provider_ids') WHERE value = ?2) \
                             ORDER BY id DESC LIMIT 1"
                        ),
                        params![query_values[0], query_values[1]],
                        read_payment_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Newest first; `cursor` is the id of the last payment of the previous page.
    pub async fn list_payments(
        &self,
        filter: PaymentListFilter,
        cursor: Option<String>,
        limit: u32,
    ) -> Result<PaymentPage, StoreError> {
        self.database
            .read(move |connection| {
                Ok(list_payment_page(
                    connection,
                    &filter,
                    cursor.as_deref(),
                    limit,
                )?)
            })
            .await
    }

    /// How many payments went through each gateway (`provider`) or used each method.
    pub async fn count_payments_by(
        &self,
        column: PaymentCountColumn,
    ) -> Result<Vec<(String, u64)>, StoreError> {
        self.database
            .read(move |connection| {
                let column_name = column.column_name();
                let mut statement = connection.prepare(&format!(
                    "SELECT {column_name}, count(*) FROM payments WHERE {column_name} IS NOT NULL GROUP BY {column_name}"
                ))?;
                let counts = statement
                    .query_map([], |row| {
                        let count: i64 = row.get(1)?;
                        Ok((row.get(0)?, u64::try_from(count).unwrap_or_default()))
                    })?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(counts)
            })
            .await
    }

    /// The Overview's payment totals; `since_unix_ms` is where "today" starts.
    pub async fn read_payment_totals(
        &self,
        since_unix_ms: i64,
    ) -> Result<PaymentTotalsRecord, StoreError> {
        self.database
            .read(move |connection| Ok(read_payment_totals_since(connection, since_unix_ms)?))
            .await
    }

    pub async fn delete_all_payments(&self) -> Result<u64, StoreError> {
        self.database
            .write(|connection| Ok(connection.execute("DELETE FROM payments", [])? as u64))
            .await
    }
}

/// What `count_payments_by` groups by.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentCountColumn {
    Provider,
    MethodKey,
}

impl PaymentCountColumn {
    fn column_name(self) -> &'static str {
        match self {
            Self::Provider => "provider",
            Self::MethodKey => "method_key",
        }
    }
}
