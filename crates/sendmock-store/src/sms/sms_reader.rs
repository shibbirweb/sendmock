use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, params_from_iter};

use super::sms_row_mapping::{SMS_COLUMNS, attach_media, read_sms_row};
use super::{SmsListFilter, SmsPage, SmsRecord, SmsThreadRecord};

/// The filter as SQL conditions joined with AND, with their parameters in the same order.
fn build_conditions(filter: &SmsListFilter) -> (String, Vec<SqlValue>) {
    let mut conditions: Vec<&str> = vec!["1 = 1"];
    let mut parameters: Vec<SqlValue> = Vec::new();
    if let Some(search_text) = filter
        .search_text
        .as_ref()
        .filter(|text| !text.trim().is_empty())
    {
        conditions.push("(instr(lower(body), lower(?)) > 0 OR instr(from_number, ?) > 0 OR instr(to_number, ?) > 0)");
        parameters.extend(std::iter::repeat_n(
            SqlValue::Text(search_text.trim().to_owned()),
            3,
        ));
    }
    for (condition, filter_value) in [
        ("from_number = ?", &filter.from_number),
        ("to_number = ?", &filter.to_number),
        ("status = ?", &filter.status),
        ("direction = ?", &filter.direction),
        ("thread_id = ?", &filter.thread_id),
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

/// Newest first; `cursor` is the id of the last message of the previous page.
pub fn list_messages(
    connection: &Connection,
    filter: &SmsListFilter,
    cursor: Option<&str>,
    limit: u32,
) -> rusqlite::Result<SmsPage> {
    let (conditions, parameters) = build_conditions(filter);
    let total_count: i64 = connection.query_row(
        &format!("SELECT count(*) FROM sms_messages WHERE {conditions}"),
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
        "SELECT {SMS_COLUMNS} FROM sms_messages WHERE {conditions}{cursor_condition} ORDER BY id DESC LIMIT ?"
    ))?;
    let mut messages = statement
        .query_map(params_from_iter(page_parameters.iter()), read_sms_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let has_more = messages.len() > limit as usize;
    messages.truncate(limit as usize);
    attach_media(connection, &mut messages)?;
    Ok(SmsPage {
        next_cursor: has_more
            .then(|| messages.last().map(|message| message.sms_id.clone()))
            .flatten(),
        messages,
        total_count: u64::try_from(total_count).unwrap_or_default(),
    })
}

/// Every conversation with its latest message, the most recent conversation first.
pub fn list_threads(connection: &Connection) -> rusqlite::Result<Vec<SmsThreadRecord>> {
    let mut statement = connection.prepare(&format!(
        "SELECT {SMS_COLUMNS}, thread_counts.message_count, thread_counts.unread_count FROM sms_messages \
         JOIN (SELECT thread_id AS counted_thread_id, max(id) AS last_id, count(*) AS message_count, \
               sum(CASE WHEN direction = 'inbound' AND is_read = 0 THEN 1 ELSE 0 END) AS unread_count \
               FROM sms_messages GROUP BY thread_id) AS thread_counts \
           ON sms_messages.id = thread_counts.last_id \
         ORDER BY sms_messages.id DESC"
    ))?;
    let mut thread_rows: Vec<(SmsRecord, i64, i64)> = statement
        .query_map([], |row| {
            Ok((read_sms_row(row)?, row.get(31)?, row.get(32)?))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut last_messages: Vec<SmsRecord> = thread_rows
        .iter()
        .map(|(message, _, _)| message.clone())
        .collect();
    attach_media(connection, &mut last_messages)?;
    Ok(thread_rows
        .drain(..)
        .zip(last_messages)
        .map(
            |((_, message_count, unread_count), last_message)| SmsThreadRecord {
                last_message,
                message_count: u64::try_from(message_count).unwrap_or_default(),
                unread_count: u64::try_from(unread_count).unwrap_or_default(),
            },
        )
        .collect())
}
