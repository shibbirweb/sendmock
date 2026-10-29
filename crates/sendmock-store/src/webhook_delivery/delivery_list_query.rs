use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, Row, params_from_iter};

use super::{WebhookDeliveryFilter, WebhookDeliveryPage, WebhookDeliveryRecord};

pub const DELIVERY_COLUMNS: &str = "id, endpoint_id, endpoint_name, rule_id, event_id, event_type, subject_id, trigger, attempt, status, retry_policy, rendered_request, sent_request, response, duration_ms, error_message, next_attempt_at, created_at";

/// The filter as SQL conditions joined with AND, with their parameters in the same order.
fn build_conditions(filter: &WebhookDeliveryFilter) -> (String, Vec<SqlValue>) {
    let mut conditions: Vec<String> = vec!["1 = 1".to_owned()];
    let mut parameters: Vec<SqlValue> = Vec::new();
    if !filter.statuses.is_empty() {
        let placeholders = vec!["?"; filter.statuses.len()].join(", ");
        conditions.push(format!("status IN ({placeholders})"));
        parameters.extend(filter.statuses.iter().cloned().map(SqlValue::Text));
    }
    for (condition, filter_value) in [
        ("endpoint_id = ?", &filter.endpoint_id),
        ("event_type = ?", &filter.event_type),
    ] {
        if let Some(filter_value) = filter_value {
            conditions.push(condition.to_owned());
            parameters.push(SqlValue::Text(filter_value.clone()));
        }
    }
    if let Some(created_after_unix_ms) = filter.created_after_unix_ms {
        conditions.push("created_at > ?".to_owned());
        parameters.push(SqlValue::Integer(created_after_unix_ms));
    }
    (conditions.join(" AND "), parameters)
}

/// Newest first; `cursor` is the id of the last delivery of the previous page.
pub fn list_deliveries(
    connection: &Connection,
    filter: &WebhookDeliveryFilter,
    cursor: Option<&str>,
    limit: u32,
) -> rusqlite::Result<WebhookDeliveryPage> {
    let (conditions, parameters) = build_conditions(filter);
    let total_count: i64 = connection.query_row(
        &format!("SELECT count(*) FROM webhook_deliveries WHERE {conditions}"),
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
        "SELECT {DELIVERY_COLUMNS} FROM webhook_deliveries WHERE {conditions}{cursor_condition} ORDER BY id DESC LIMIT ?"
    ))?;
    let mut deliveries = statement
        .query_map(params_from_iter(page_parameters.iter()), read_delivery_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let has_more = deliveries.len() > limit as usize;
    deliveries.truncate(limit as usize);
    Ok(WebhookDeliveryPage {
        next_cursor: has_more
            .then(|| {
                deliveries
                    .last()
                    .map(|delivery| delivery.delivery_id.clone())
            })
            .flatten(),
        deliveries,
        total_count: u64::try_from(total_count).unwrap_or_default(),
    })
}

pub fn read_delivery_row(row: &Row<'_>) -> rusqlite::Result<WebhookDeliveryRecord> {
    Ok(WebhookDeliveryRecord {
        delivery_id: row.get(0)?,
        endpoint_id: row.get(1)?,
        endpoint_name: row.get(2)?,
        rule_id: row.get(3)?,
        event_id: row.get(4)?,
        event_type: row.get(5)?,
        subject_id: row.get(6)?,
        trigger: row.get(7)?,
        attempt: row.get(8)?,
        status: row.get(9)?,
        retry_policy_json: row.get(10)?,
        rendered_request_json: row.get(11)?,
        sent_request_json: row.get(12)?,
        response_json: row.get(13)?,
        duration_ms: row.get(14)?,
        error_message: row.get(15)?,
        next_attempt_at_unix_ms: row.get(16)?,
        created_at_unix_ms: row.get(17)?,
    })
}
