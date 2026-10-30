use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, Row, params_from_iter};

/// What the metrics read from one attempt, without its request and response bodies.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeliveryOutcomeRecord {
    pub delivery_id: String,
    pub endpoint_id: String,
    pub endpoint_name: String,
    pub event_type: String,
    pub attempt: u32,
    pub status: String,
    pub response_status_code: Option<u16>,
    pub duration_ms: Option<u32>,
    pub error_message: Option<String>,
    pub has_retry_due: bool,
    pub created_at_unix_ms: i64,
}

/// Which attempts the metrics read.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DeliveryOutcomeFilter {
    /// Only attempts made at or after this time; none means every attempt.
    pub created_from_unix_ms: Option<i64>,
    pub endpoint_id: Option<String>,
}

/// Oldest first, then in the order they were stored.
pub fn list_delivery_outcomes(
    connection: &Connection,
    filter: &DeliveryOutcomeFilter,
) -> rusqlite::Result<Vec<DeliveryOutcomeRecord>> {
    let mut conditions = vec!["1 = 1"];
    let mut parameters: Vec<SqlValue> = Vec::new();
    if let Some(created_from_unix_ms) = filter.created_from_unix_ms {
        conditions.push("created_at >= ?");
        parameters.push(SqlValue::Integer(created_from_unix_ms));
    }
    if let Some(endpoint_id) = &filter.endpoint_id {
        conditions.push("endpoint_id = ?");
        parameters.push(SqlValue::Text(endpoint_id.clone()));
    }
    let mut statement = connection.prepare(&format!(
        "SELECT id, endpoint_id, endpoint_name, event_type, attempt, status, \
         json_extract(response, '$.status_code'), duration_ms, error_message, \
         status = 'failed' AND next_attempt_at IS NOT NULL, created_at \
         FROM webhook_deliveries WHERE {} ORDER BY created_at, rowid",
        conditions.join(" AND ")
    ))?;
    statement
        .query_map(params_from_iter(parameters.iter()), read_outcome_row)?
        .collect()
}

fn read_outcome_row(row: &Row<'_>) -> rusqlite::Result<DeliveryOutcomeRecord> {
    Ok(DeliveryOutcomeRecord {
        delivery_id: row.get(0)?,
        endpoint_id: row.get(1)?,
        endpoint_name: row.get(2)?,
        event_type: row.get(3)?,
        attempt: row.get(4)?,
        status: row.get(5)?,
        response_status_code: row.get(6)?,
        duration_ms: row.get(7)?,
        error_message: row.get(8)?,
        has_retry_due: row.get(9)?,
        created_at_unix_ms: row.get(10)?,
    })
}
