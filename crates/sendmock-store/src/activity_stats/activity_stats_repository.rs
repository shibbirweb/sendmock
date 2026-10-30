use std::sync::Arc;

use rusqlite::{Connection, Row, params};

use super::{HourlyActivityRecord, HourlyCountRecord, MessageTotalsRecord};
use crate::{Database, StoreError};

const HOUR_MS: i64 = 60 * 60 * 1_000;

const MESSAGE_TOTALS_QUERY: &str = "SELECT \
    (SELECT count(*) FROM emails), \
    (SELECT count(*) FROM emails WHERE received_at >= ?1), \
    (SELECT count(*) FROM emails WHERE is_read = 0), \
    (SELECT count(*) FROM sms_messages), \
    (SELECT count(*) FROM sms_messages WHERE created_at >= ?1), \
    (SELECT count(*) FROM sms_messages WHERE direction = 'inbound' AND is_read = 0), \
    (SELECT count(*) FROM verifications), \
    (SELECT count(*) FROM verifications WHERE status = 'pending')";

/// Counts across emails, SMS and verifications for the Overview, read in one place so the
/// message repositories keep to their own lists.
#[derive(Clone)]
pub struct ActivityStatsRepository {
    database: Arc<Database>,
}

impl ActivityStatsRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Totals, with the emails and SMS that arrived at or after `since_unix_ms`.
    pub async fn read_message_totals(
        &self,
        since_unix_ms: i64,
    ) -> Result<MessageTotalsRecord, StoreError> {
        self.database
            .read(move |connection| {
                Ok(
                    connection.query_row(MESSAGE_TOTALS_QUERY, [since_unix_ms], |row| {
                        Ok(MessageTotalsRecord {
                            email_count: read_count(row, 0)?,
                            emails_since: read_count(row, 1)?,
                            unread_email_count: read_count(row, 2)?,
                            sms_count: read_count(row, 3)?,
                            sms_since: read_count(row, 4)?,
                            unread_sms_count: read_count(row, 5)?,
                            verification_count: read_count(row, 6)?,
                            pending_verification_count: read_count(row, 7)?,
                        })
                    })?,
                )
            })
            .await
    }

    /// Emails and SMS per hour from `window_start_unix_ms` on.
    pub async fn count_messages_by_hour(
        &self,
        window_start_unix_ms: i64,
    ) -> Result<HourlyActivityRecord, StoreError> {
        self.database
            .read(move |connection| {
                Ok(HourlyActivityRecord {
                    email_counts: count_rows_by_hour(
                        connection,
                        "emails",
                        "received_at",
                        window_start_unix_ms,
                    )?,
                    sms_counts: count_rows_by_hour(
                        connection,
                        "sms_messages",
                        "created_at",
                        window_start_unix_ms,
                    )?,
                })
            })
            .await
    }
}

fn read_count(row: &Row<'_>, column_index: usize) -> rusqlite::Result<u64> {
    let count: i64 = row.get(column_index)?;
    Ok(u64::try_from(count).unwrap_or_default())
}

/// `table_name` and `time_column` are fixed names from this file, never input.
fn count_rows_by_hour(
    connection: &Connection,
    table_name: &str,
    time_column: &str,
    window_start_unix_ms: i64,
) -> rusqlite::Result<Vec<HourlyCountRecord>> {
    let mut statement = connection.prepare(&format!(
        "SELECT ({time_column} - ?1) / ?2 AS hour_offset, count(*) FROM {table_name} \
         WHERE {time_column} >= ?1 GROUP BY hour_offset ORDER BY hour_offset"
    ))?;
    statement
        .query_map(params![window_start_unix_ms, HOUR_MS], |row| {
            Ok(HourlyCountRecord {
                hour_offset: row.get(0)?,
                item_count: read_count(row, 1)?,
            })
        })?
        .collect()
}
