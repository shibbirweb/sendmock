use rusqlite::params_from_iter;
use rusqlite::types::Value as SqlValue;

use super::email_reader::with_attachments;
use super::email_row_mapping::{EMAIL_COLUMNS, read_email_row};
use super::{EmailListFilter, EmailRecord, EmailRepository};
use crate::StoreError;

/// Queries for APIs that see the mail as one mailbox paged by position, as Mailpit's does.
impl EmailRepository {
    /// Up to `limit` emails matching the filter, newest first, after skipping `offset` of them.
    pub async fn list_emails_at_offset(
        &self,
        filter: EmailListFilter,
        offset: u64,
        limit: u32,
    ) -> Result<Vec<EmailRecord>, StoreError> {
        self.database()
            .read(move |connection| {
                let (conditions, mut parameters) = filter.to_sql_conditions();
                parameters.push(SqlValue::Integer(i64::from(limit)));
                parameters.push(SqlValue::Integer(i64::try_from(offset).unwrap_or(i64::MAX)));
                let mut statement = connection.prepare(&format!(
                    "SELECT {EMAIL_COLUMNS} FROM emails WHERE {conditions} ORDER BY emails.id DESC LIMIT ? OFFSET ?"
                ))?;
                let emails = statement
                    .query_map(params_from_iter(parameters.iter()), read_email_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(emails
                    .into_iter()
                    .map(|email| with_attachments(connection, email))
                    .collect::<rusqlite::Result<Vec<_>>>()?)
            })
            .await
    }

    pub async fn count_emails(&self, filter: EmailListFilter) -> Result<u64, StoreError> {
        self.database()
            .read(move |connection| {
                let (conditions, parameters) = filter.to_sql_conditions();
                let email_count: i64 = connection.query_row(
                    &format!("SELECT count(*) FROM emails WHERE {conditions}"),
                    params_from_iter(parameters.iter()),
                    |row| row.get(0),
                )?;
                Ok(u64::try_from(email_count).unwrap_or_default())
            })
            .await
    }

    /// Every tag on any email, in alphabetical order.
    pub async fn list_email_tags(&self) -> Result<Vec<String>, StoreError> {
        self.database()
            .read(|connection| {
                let mut statement = connection.prepare(
                    "SELECT DISTINCT json_each.value FROM emails, json_each(emails.tags) ORDER BY json_each.value",
                )?;
                Ok(statement
                    .query_map([], |row| row.get::<_, String>(0))?
                    .collect::<rusqlite::Result<Vec<_>>>()?)
            })
            .await
    }

    /// Marks the emails the filter lists (every email with an empty filter) read or unread;
    /// answers how many changed.
    pub async fn set_read_for_matching(
        &self,
        filter: EmailListFilter,
        is_read: bool,
    ) -> Result<u64, StoreError> {
        self.database()
            .write(move |connection| {
                let (conditions, mut parameters) = filter.to_sql_conditions();
                parameters.insert(0, SqlValue::Integer(i64::from(is_read)));
                let changed_count = connection.execute(
                    &format!("UPDATE emails SET is_read = ? WHERE {conditions}"),
                    params_from_iter(parameters.iter()),
                )?;
                Ok(u64::try_from(changed_count).unwrap_or_default())
            })
            .await
    }
}
