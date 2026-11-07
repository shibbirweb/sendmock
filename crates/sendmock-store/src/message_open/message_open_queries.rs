use rusqlite::{Connection, OptionalExtension, params};

use super::{MessageOpenRecord, OpenRecording};

/// The message table that keeps the open count and the table of single opens.
pub(crate) struct OpenTables {
    messages_table: &'static str,
    opens_table: &'static str,
    message_id_column: &'static str,
}

pub(crate) const EMAIL_OPENS: OpenTables = OpenTables {
    messages_table: "emails",
    opens_table: "email_opens",
    message_id_column: "email_id",
};

pub(crate) const SMS_OPENS: OpenTables = OpenTables {
    messages_table: "sms_messages",
    opens_table: "sms_opens",
    message_id_column: "sms_id",
};

/// Counts the open on the message, keeps the first open time and adds the open to the
/// history; answers the new open count, or `None` when nothing was recorded (the message is
/// gone, or it was opened already and only a first open counts).
pub(crate) fn insert_open(
    connection: &Connection,
    open_tables: &OpenTables,
    message_id: &str,
    message_open: &MessageOpenRecord,
    open_recording: OpenRecording,
) -> rusqlite::Result<Option<u64>> {
    let unopened_condition = match open_recording {
        OpenRecording::Always => "",
        OpenRecording::OnlyIfUnopened => " AND open_count = 0",
    };
    let messages_table = open_tables.messages_table;
    let new_open_count: Option<i64> = connection
        .query_row(
            &format!(
                "UPDATE {messages_table} SET open_count = open_count + 1, \
                 opened_at = coalesce(opened_at, ?2) WHERE id = ?1{unopened_condition} \
                 RETURNING open_count"
            ),
            params![message_id, message_open.opened_at_unix_ms],
            |row| row.get(0),
        )
        .optional()?;
    let Some(new_open_count) = new_open_count else {
        return Ok(None);
    };
    connection.execute(
        &format!(
            "INSERT INTO {} ({}, opened_at, source, user_agent) VALUES (?1, ?2, ?3, ?4)",
            open_tables.opens_table, open_tables.message_id_column
        ),
        params![
            message_id,
            message_open.opened_at_unix_ms,
            message_open.source,
            message_open.user_agent
        ],
    )?;
    Ok(Some(u64::try_from(new_open_count).unwrap_or_default()))
}

/// The message's opens, oldest first.
pub(crate) fn list_opens(
    connection: &Connection,
    open_tables: &OpenTables,
    message_id: &str,
) -> rusqlite::Result<Vec<MessageOpenRecord>> {
    let mut statement = connection.prepare(&format!(
        "SELECT opened_at, source, user_agent FROM {} WHERE {} = ?1 ORDER BY opened_at, rowid",
        open_tables.opens_table, open_tables.message_id_column
    ))?;
    statement
        .query_map([message_id], |row| {
            Ok(MessageOpenRecord {
                opened_at_unix_ms: row.get(0)?,
                source: row.get(1)?,
                user_agent: row.get(2)?,
            })
        })?
        .collect()
}
