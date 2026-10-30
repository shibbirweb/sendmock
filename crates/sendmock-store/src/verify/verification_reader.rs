use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, Row, params_from_iter};

use super::{VerificationFilter, VerificationPage, VerificationRecord};

pub const VERIFICATION_COLUMNS: &str = "sid, service_sid, service_name, account_sid, to_address, channel, code, status, check_attempts, send_attempts, expires_at, linked_message_id, linked_thread_id, created_at, updated_at";

/// The filter as SQL conditions joined with AND, with their parameters in the same order.
fn build_conditions(filter: &VerificationFilter) -> (String, Vec<SqlValue>) {
    let mut conditions = vec!["1 = 1".to_owned()];
    let mut parameters: Vec<SqlValue> = Vec::new();
    if !filter.statuses.is_empty() {
        conditions.push(format!(
            "status IN ({})",
            vec!["?"; filter.statuses.len()].join(", ")
        ));
        parameters.extend(filter.statuses.iter().cloned().map(SqlValue::Text));
    }
    if let Some(to_text) = filter
        .to_text
        .as_ref()
        .filter(|to_text| !to_text.trim().is_empty())
    {
        conditions.push("instr(to_address, ?) > 0".to_owned());
        parameters.push(SqlValue::Text(to_text.trim().to_owned()));
    }
    if let Some(channel) = &filter.channel {
        conditions.push("channel = ?".to_owned());
        parameters.push(SqlValue::Text(channel.clone()));
    }
    (conditions.join(" AND "), parameters)
}

/// Newest first; `cursor` is the SID of the last verification of the previous page.
pub fn select_page(
    connection: &Connection,
    filter: &VerificationFilter,
    cursor: Option<&str>,
    limit: u32,
) -> rusqlite::Result<VerificationPage> {
    let (condition_text, parameters) = build_conditions(filter);
    let total_count: i64 = connection.query_row(
        &format!("SELECT count(*) FROM verifications WHERE {condition_text}"),
        params_from_iter(parameters.iter()),
        |row| row.get(0),
    )?;
    let mut page_parameters = parameters;
    let cursor_condition = match cursor {
        Some(cursor) => {
            page_parameters.push(SqlValue::Text(cursor.to_owned()));
            " AND rowid < (SELECT rowid FROM verifications WHERE sid = ?)"
        }
        None => "",
    };
    page_parameters.push(SqlValue::Integer(i64::from(limit) + 1));
    let mut statement = connection.prepare(&format!(
        "SELECT {VERIFICATION_COLUMNS} FROM verifications WHERE {condition_text}{cursor_condition} ORDER BY rowid DESC LIMIT ?"
    ))?;
    let mut verifications = statement
        .query_map(
            params_from_iter(page_parameters.iter()),
            read_verification_row,
        )?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let has_more = verifications.len() > limit as usize;
    verifications.truncate(limit as usize);
    Ok(VerificationPage {
        next_cursor: has_more
            .then(|| {
                verifications
                    .last()
                    .map(|verification| verification.verification_sid.clone())
            })
            .flatten(),
        verifications,
        total_count: u64::try_from(total_count).unwrap_or_default(),
    })
}

pub fn read_verification_row(row: &Row<'_>) -> rusqlite::Result<VerificationRecord> {
    Ok(VerificationRecord {
        verification_sid: row.get(0)?,
        service_sid: row.get(1)?,
        service_name: row.get(2)?,
        account_sid: row.get(3)?,
        to_address: row.get(4)?,
        channel: row.get(5)?,
        code: row.get(6)?,
        status: row.get(7)?,
        check_attempts: row.get(8)?,
        send_attempts: row.get(9)?,
        expires_at_unix_ms: row.get(10)?,
        linked_message_id: row.get(11)?,
        linked_thread_id: row.get(12)?,
        created_at_unix_ms: row.get(13)?,
        updated_at_unix_ms: row.get(14)?,
    })
}
