use rusqlite::{Connection, Row, params};

use super::{SmsMediaRecord, SmsRecord};

pub const SMS_COLUMNS: &str = "id, provider_id, direction, channel, api, from_number, from_raw, to_number, to_raw, \
     thread_id, app_number, contact_number, body, encoding, segments, status, error_code, status_callback_url, \
     messaging_service_sid, account, otp_codes, links, metadata, request_body, api_request_id, opened_at, \
     open_count, is_read, in_reply_to_sms_id, created_at, updated_at";

/// A row in `SMS_COLUMNS` order, without its media (see `attach_media`).
pub fn read_sms_row(row: &Row<'_>) -> rusqlite::Result<SmsRecord> {
    let otp_codes_json: String = row.get(20)?;
    let links_json: String = row.get(21)?;
    let open_count: i64 = row.get(26)?;
    Ok(SmsRecord {
        sms_id: row.get(0)?,
        provider_id: row.get(1)?,
        direction: row.get(2)?,
        channel: row.get(3)?,
        api: row.get(4)?,
        from_number: row.get(5)?,
        from_raw: row.get(6)?,
        to_number: row.get(7)?,
        to_raw: row.get(8)?,
        thread_id: row.get(9)?,
        app_number: row.get(10)?,
        contact_number: row.get(11)?,
        body: row.get(12)?,
        encoding: row.get(13)?,
        segments: row.get(14)?,
        status: row.get(15)?,
        error_code: row.get(16)?,
        status_callback_url: row.get(17)?,
        messaging_service_sid: row.get(18)?,
        account: row.get(19)?,
        otp_codes: serde_json::from_str(&otp_codes_json).unwrap_or_default(),
        links: serde_json::from_str(&links_json).unwrap_or_default(),
        metadata_json: row.get(22)?,
        request_body_json: row.get(23)?,
        api_request_id: row.get(24)?,
        opened_at_unix_ms: row.get(25)?,
        open_count: u64::try_from(open_count).unwrap_or_default(),
        is_read: row.get(27)?,
        in_reply_to_sms_id: row.get(28)?,
        created_at_unix_ms: row.get(29)?,
        updated_at_unix_ms: row.get(30)?,
        media: Vec::new(),
    })
}

/// Fills in each message's media descriptions.
pub fn attach_media(connection: &Connection, messages: &mut [SmsRecord]) -> rusqlite::Result<()> {
    let mut statement = connection.prepare(
        "SELECT media_index, content_type, filename, source_url, size_bytes FROM sms_media WHERE sms_id = ?1 ORDER BY media_index",
    )?;
    for message in messages.iter_mut() {
        message.media = statement
            .query_map([&message.sms_id], |row| {
                let size_bytes: i64 = row.get(4)?;
                Ok(SmsMediaRecord {
                    media_index: row.get(0)?,
                    content_type: row.get(1)?,
                    filename: row.get(2)?,
                    source_url: row.get(3)?,
                    size_bytes: u64::try_from(size_bytes).unwrap_or_default(),
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
    }
    Ok(())
}

pub fn insert_sms_row(connection: &Connection, sms: &SmsRecord) -> rusqlite::Result<()> {
    connection.execute(
        &format!(
            "INSERT INTO sms_messages ({SMS_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, \
             ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31)"
        ),
        params![
            sms.sms_id,
            sms.provider_id,
            sms.direction,
            sms.channel,
            sms.api,
            sms.from_number,
            sms.from_raw,
            sms.to_number,
            sms.to_raw,
            sms.thread_id,
            sms.app_number,
            sms.contact_number,
            sms.body,
            sms.encoding,
            sms.segments,
            sms.status,
            sms.error_code,
            sms.status_callback_url,
            sms.messaging_service_sid,
            sms.account,
            serde_json::to_string(&sms.otp_codes).unwrap_or_else(|_| "[]".to_owned()),
            serde_json::to_string(&sms.links).unwrap_or_else(|_| "[]".to_owned()),
            sms.metadata_json,
            sms.request_body_json,
            sms.api_request_id,
            sms.opened_at_unix_ms,
            i64::try_from(sms.open_count).unwrap_or(i64::MAX),
            sms.is_read,
            sms.in_reply_to_sms_id,
            sms.created_at_unix_ms,
            sms.updated_at_unix_ms,
        ],
    )?;
    Ok(())
}
