use std::sync::Arc;

use rusqlite::{Connection, params};

use super::email_reader;
use super::email_row_mapping::to_json_column;
use super::{
    AttachmentRecord, EmailListFilter, EmailPage, EmailRecord, NewEmailRecord, TimelineRecord,
};
use crate::{Database, StoreError};

/// Rows deleted per statement while pruning, so ingest never waits long on the writer.
const PRUNE_BATCH_SIZE: i64 = 500;

/// Every email query; no business rules.
#[derive(Clone)]
pub struct EmailRepository {
    database: Arc<Database>,
}

impl EmailRepository {
    pub(super) fn database(&self) -> &Database {
        &self.database
    }

    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn insert_email(&self, new_email: NewEmailRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                insert_email_row(&transaction, &new_email)?;
                for new_attachment in &new_email.attachments {
                    insert_attachment_row(
                        &transaction,
                        &new_email.email.email_id,
                        &new_attachment.attachment,
                        &new_attachment.content,
                    )?;
                }
                transaction.commit()?;
                Ok(())
            })
            .await
    }

    pub async fn find_email(&self, email_id: &str) -> Result<Option<EmailRecord>, StoreError> {
        let email_id = email_id.to_owned();
        self.database
            .read(move |connection| Ok(email_reader::find_email(connection, &email_id)?))
            .await
    }

    pub async fn list_emails(
        &self,
        filter: EmailListFilter,
        cursor: Option<String>,
        limit: u32,
    ) -> Result<EmailPage, StoreError> {
        self.database
            .read(move |connection| {
                Ok(email_reader::list_emails(
                    connection,
                    &filter,
                    cursor.as_deref(),
                    limit,
                )?)
            })
            .await
    }

    pub async fn read_compressed_raw_message(
        &self,
        email_id: &str,
    ) -> Result<Option<Vec<u8>>, StoreError> {
        let email_id = email_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(email_reader::read_compressed_raw_message(
                    connection, &email_id,
                )?)
            })
            .await
    }

    pub async fn read_attachment_content(
        &self,
        email_id: &str,
        attachment_index: u32,
    ) -> Result<Option<(AttachmentRecord, Vec<u8>)>, StoreError> {
        let email_id = email_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(email_reader::read_attachment_content(
                    connection,
                    &email_id,
                    attachment_index,
                )?)
            })
            .await
    }

    pub async fn list_timeline(&self, email_id: &str) -> Result<Vec<TimelineRecord>, StoreError> {
        let email_id = email_id.to_owned();
        self.database
            .read(move |connection| Ok(email_reader::list_timeline(connection, &email_id)?))
            .await
    }

    /// Changes what is given and answers the updated email, or `None` when it does not exist.
    pub async fn update_read_and_tags(
        &self,
        email_id: &str,
        is_read: Option<bool>,
        tags: Option<Vec<String>>,
    ) -> Result<Option<EmailRecord>, StoreError> {
        let email_id = email_id.to_owned();
        self.database
            .write(move |connection| {
                if let Some(is_read) = is_read {
                    connection.execute(
                        "UPDATE emails SET is_read = ?1 WHERE id = ?2",
                        params![is_read, email_id],
                    )?;
                }
                if let Some(tags) = &tags {
                    connection.execute(
                        "UPDATE emails SET tags = ?1 WHERE id = ?2",
                        params![to_json_column(tags), email_id],
                    )?;
                }
                Ok(email_reader::find_email(connection, &email_id)?)
            })
            .await
    }

    /// True when an email was deleted.
    pub async fn delete_email(&self, email_id: &str) -> Result<bool, StoreError> {
        let email_id = email_id.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection.execute("DELETE FROM emails WHERE id = ?1", [email_id])? > 0)
            })
            .await
    }

    pub async fn delete_all_emails(&self) -> Result<u64, StoreError> {
        self.database
            .write(|connection| {
                Ok(
                    u64::try_from(connection.execute("DELETE FROM emails", [])?)
                        .unwrap_or_default(),
                )
            })
            .await
    }

    pub async fn add_timeline_entry(
        &self,
        email_id: &str,
        timeline_entry: TimelineRecord,
    ) -> Result<(), StoreError> {
        let email_id = email_id.to_owned();
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT INTO email_timeline (email_id, kind, happened_at, detail) VALUES (?1, ?2, ?3, ?4)",
                    params![email_id, timeline_entry.kind, timeline_entry.happened_at_unix_ms, timeline_entry.detail],
                )?;
                Ok(())
            })
            .await
    }

    /// Deletes the oldest emails beyond `max_count` and those received before the cut-off,
    /// in batches; answers how many were deleted.
    pub async fn prune_emails(
        &self,
        max_count: Option<u64>,
        received_before_unix_ms: Option<i64>,
    ) -> Result<u64, StoreError> {
        self.database
            .write(move |connection| {
                let mut deleted_count = 0_u64;
                if let Some(received_before_unix_ms) = received_before_unix_ms {
                    deleted_count += delete_in_batches(connection, "DELETE FROM emails WHERE id IN (SELECT id FROM emails WHERE received_at < ?1 LIMIT ?2)", received_before_unix_ms)?;
                }
                if let Some(max_count) = max_count {
                    let kept_count = i64::try_from(max_count).unwrap_or(i64::MAX);
                    deleted_count += delete_in_batches(
                        connection,
                        "DELETE FROM emails WHERE id IN (SELECT id FROM emails ORDER BY id DESC LIMIT -1 OFFSET ?1) \
                         AND id IN (SELECT id FROM emails ORDER BY id ASC LIMIT ?2)",
                        kept_count,
                    )?;
                }
                Ok(deleted_count)
            })
            .await
    }
}

fn delete_in_batches(
    connection: &Connection,
    delete_statement: &str,
    bound_value: i64,
) -> Result<u64, StoreError> {
    let mut deleted_count = 0_u64;
    loop {
        let batch_deleted =
            connection.execute(delete_statement, params![bound_value, PRUNE_BATCH_SIZE])?;
        deleted_count += u64::try_from(batch_deleted).unwrap_or_default();
        if i64::try_from(batch_deleted).unwrap_or_default() < PRUNE_BATCH_SIZE {
            return Ok(deleted_count);
        }
    }
}

fn insert_email_row(
    connection: &Connection,
    new_email: &NewEmailRecord,
) -> rusqlite::Result<usize> {
    let email = &new_email.email;
    connection.execute(
        "INSERT INTO emails (id, received_at, message_id, subject, from_address, to_addresses, cc_addresses, \
         bcc_addresses, reply_to_addresses, envelope_from, envelope_to, headers, text_body, html_body, snippet, \
         size_bytes, attachment_count, is_read, tags, source, direction, delivery_status, open_count, opened_at, \
         otp_codes, links, smtp_session_id, smtp_auth_user, mime_tree, raw_message) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, \
         ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30)",
        rusqlite::params![
            email.email_id,
            email.received_at_unix_ms,
            email.message_id,
            email.subject,
            to_json_column(&email.from),
            to_json_column(&email.to),
            to_json_column(&email.cc),
            to_json_column(&email.bcc),
            to_json_column(&email.reply_to),
            email.envelope_from,
            to_json_column(&email.envelope_to),
            to_json_column(&email.headers),
            email.text_body,
            email.html_body,
            email.snippet,
            i64::try_from(email.size_bytes).unwrap_or(i64::MAX),
            i64::try_from(new_email.attachments.len()).unwrap_or_default(),
            email.is_read,
            to_json_column(&email.tags),
            email.source,
            email.direction,
            email.delivery_status,
            i64::try_from(email.open_count).unwrap_or_default(),
            email.opened_at_unix_ms,
            to_json_column(&email.otp_codes),
            to_json_column(&email.links),
            email.smtp_session_id,
            email.smtp_auth_user,
            email.mime_tree_json,
            new_email.compressed_raw_message,
        ],
    )
}

fn insert_attachment_row(
    connection: &Connection,
    email_id: &str,
    attachment: &AttachmentRecord,
    content: &[u8],
) -> rusqlite::Result<usize> {
    connection.execute(
        "INSERT INTO email_attachments (email_id, attachment_index, filename, content_type, size_bytes, content_id, is_inline, content) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            email_id,
            attachment.attachment_index,
            attachment.filename,
            attachment.content_type,
            i64::try_from(attachment.size_bytes).unwrap_or(i64::MAX),
            attachment.content_id,
            attachment.is_inline,
            content,
        ],
    )
}
