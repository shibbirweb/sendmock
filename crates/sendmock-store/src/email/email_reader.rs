use rusqlite::{Connection, OptionalExtension, params, params_from_iter};

use super::email_row_mapping::{EMAIL_COLUMNS, read_email_row};
use super::{AttachmentRecord, EmailListFilter, EmailPage, EmailRecord, TimelineRecord};

/// Queries that read emails, run on a read connection.
pub fn find_email(
    connection: &Connection,
    email_id: &str,
) -> rusqlite::Result<Option<EmailRecord>> {
    let email = connection
        .query_row(
            &format!("SELECT {EMAIL_COLUMNS} FROM emails WHERE id = ?1"),
            [email_id],
            read_email_row,
        )
        .optional()?;
    email
        .map(|email| with_attachments(connection, email))
        .transpose()
}

/// Newest first; `cursor` is the id of the last email of the previous page.
pub fn list_emails(
    connection: &Connection,
    filter: &EmailListFilter,
    cursor: Option<&str>,
    limit: u32,
) -> rusqlite::Result<EmailPage> {
    let (conditions, mut parameters) = filter.to_sql_conditions();
    let total_count: i64 = connection.query_row(
        &format!("SELECT count(*) FROM emails WHERE {conditions}"),
        params_from_iter(parameters.iter()),
        |row| row.get(0),
    )?;
    let cursor_condition = match cursor {
        Some(cursor_id) => {
            parameters.push(rusqlite::types::Value::Text(cursor_id.to_owned()));
            " AND emails.id < ?"
        }
        None => "",
    };
    parameters.push(rusqlite::types::Value::Integer(i64::from(limit) + 1));
    let mut statement = connection.prepare(&format!(
        "SELECT {EMAIL_COLUMNS} FROM emails WHERE {conditions}{cursor_condition} ORDER BY emails.id DESC LIMIT ?"
    ))?;
    let mut emails = statement
        .query_map(params_from_iter(parameters.iter()), read_email_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let has_more = emails.len() > limit as usize;
    emails.truncate(limit as usize);
    let next_cursor = has_more
        .then(|| emails.last().map(|email| email.email_id.clone()))
        .flatten();
    let emails = emails
        .into_iter()
        .map(|email| with_attachments(connection, email))
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(EmailPage {
        emails,
        next_cursor,
        total_count: u64::try_from(total_count).unwrap_or_default(),
    })
}

pub fn read_compressed_raw_message(
    connection: &Connection,
    email_id: &str,
) -> rusqlite::Result<Option<Vec<u8>>> {
    connection
        .query_row(
            "SELECT raw_message FROM emails WHERE id = ?1",
            [email_id],
            |row| row.get(0),
        )
        .optional()
}

pub fn read_attachment_content(
    connection: &Connection,
    email_id: &str,
    attachment_index: u32,
) -> rusqlite::Result<Option<(AttachmentRecord, Vec<u8>)>> {
    connection
        .query_row(
            "SELECT attachment_index, filename, content_type, size_bytes, content_id, is_inline, content \
             FROM email_attachments WHERE email_id = ?1 AND attachment_index = ?2",
            params![email_id, attachment_index],
            |row| Ok((read_attachment_row(row)?, row.get(6)?)),
        )
        .optional()
}

pub fn list_timeline(
    connection: &Connection,
    email_id: &str,
) -> rusqlite::Result<Vec<TimelineRecord>> {
    let mut statement =
        connection.prepare("SELECT kind, happened_at, detail FROM email_timeline WHERE email_id = ?1 ORDER BY happened_at, rowid")?;
    statement
        .query_map([email_id], |row| {
            Ok(TimelineRecord {
                kind: row.get(0)?,
                happened_at_unix_ms: row.get(1)?,
                detail: row.get(2)?,
            })
        })?
        .collect()
}

fn with_attachments(
    connection: &Connection,
    mut email: EmailRecord,
) -> rusqlite::Result<EmailRecord> {
    let mut statement = connection.prepare_cached(
        "SELECT attachment_index, filename, content_type, size_bytes, content_id, is_inline \
         FROM email_attachments WHERE email_id = ?1 ORDER BY attachment_index",
    )?;
    email.attachments = statement
        .query_map([&email.email_id], read_attachment_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(email)
}

fn read_attachment_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<AttachmentRecord> {
    Ok(AttachmentRecord {
        attachment_index: row.get(0)?,
        filename: row.get(1)?,
        content_type: row.get(2)?,
        size_bytes: u64::try_from(row.get::<_, i64>(3)?).unwrap_or_default(),
        content_id: row.get(4)?,
        is_inline: row.get(5)?,
    })
}
