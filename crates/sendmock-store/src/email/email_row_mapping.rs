use rusqlite::Row;
use serde::de::DeserializeOwned;

use super::EmailRecord;

/// Every `emails` column except the raw message, in the order [`read_email_row`] reads them.
pub const EMAIL_COLUMNS: &str = "id, received_at, message_id, subject, from_address, to_addresses, cc_addresses, \
     bcc_addresses, reply_to_addresses, envelope_from, envelope_to, headers, text_body, html_body, snippet, \
     size_bytes, is_read, tags, source, direction, delivery_status, open_count, opened_at, otp_codes, links, \
     smtp_session_id, smtp_auth_user, mime_tree";

/// A JSON column read into its type; a damaged value reads as the type's default.
fn read_json_column<Column: DeserializeOwned + Default>(
    row: &Row<'_>,
    column_index: usize,
) -> rusqlite::Result<Column> {
    let column_text: String = row.get(column_index)?;
    Ok(serde_json::from_str(&column_text).unwrap_or_default())
}

pub fn read_email_row(row: &Row<'_>) -> rusqlite::Result<EmailRecord> {
    Ok(EmailRecord {
        email_id: row.get(0)?,
        received_at_unix_ms: row.get(1)?,
        message_id: row.get(2)?,
        subject: row.get(3)?,
        from: read_json_column(row, 4)?,
        to: read_json_column(row, 5)?,
        cc: read_json_column(row, 6)?,
        bcc: read_json_column(row, 7)?,
        reply_to: read_json_column(row, 8)?,
        envelope_from: row.get(9)?,
        envelope_to: read_json_column(row, 10)?,
        headers: read_json_column(row, 11)?,
        text_body: row.get(12)?,
        html_body: row.get(13)?,
        snippet: row.get(14)?,
        size_bytes: u64::try_from(row.get::<_, i64>(15)?).unwrap_or_default(),
        is_read: row.get(16)?,
        tags: read_json_column(row, 17)?,
        source: row.get(18)?,
        direction: row.get(19)?,
        delivery_status: row.get(20)?,
        open_count: u64::try_from(row.get::<_, i64>(21)?).unwrap_or_default(),
        opened_at_unix_ms: row.get(22)?,
        otp_codes: read_json_column(row, 23)?,
        links: read_json_column(row, 24)?,
        smtp_session_id: row.get(25)?,
        smtp_auth_user: row.get(26)?,
        mime_tree_json: row.get(27)?,
        attachments: Vec::new(),
    })
}

/// Serialises a value for a JSON column; values SendMock builds itself always serialise.
pub fn to_json_column<Column: serde::Serialize>(column_value: &Column) -> String {
    serde_json::to_string(column_value).unwrap_or_else(|_| "null".to_owned())
}
