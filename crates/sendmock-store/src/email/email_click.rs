use rusqlite::{OptionalExtension, params};

use super::{EmailRepository, TimelineRecord};
use crate::StoreError;

/// One click on a link of an email.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailClickRecord {
    pub clicked_at_unix_ms: i64,
    pub url: String,
    pub source: String,
    pub user_agent: Option<String>,
}

/// What recording a click answers: whether it was the link's first, and the email's count.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RecordedEmailClick {
    pub is_first_click: bool,
    pub click_count: u64,
}

impl EmailRepository {
    /// Records the click and adds it to the timeline in one transaction; `None` when the email
    /// does not exist.
    pub async fn record_click(
        &self,
        email_id: &str,
        email_click: EmailClickRecord,
        timeline_entry: TimelineRecord,
    ) -> Result<Option<RecordedEmailClick>, StoreError> {
        let email_id = email_id.to_owned();
        self.database()
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let is_email_stored = transaction
                    .query_row("SELECT 1 FROM emails WHERE id = ?1", [&email_id], |_| Ok(()))
                    .optional()?
                    .is_some();
                if !is_email_stored {
                    return Ok(None);
                }
                let earlier_clicks_on_link: i64 = transaction.query_row(
                    "SELECT count(*) FROM email_clicks WHERE email_id = ?1 AND url = ?2",
                    params![email_id, email_click.url],
                    |row| row.get(0),
                )?;
                transaction.execute(
                    "INSERT INTO email_clicks (email_id, clicked_at, url, source, user_agent) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![email_id, email_click.clicked_at_unix_ms, email_click.url, email_click.source, email_click.user_agent],
                )?;
                transaction.execute(
                    "INSERT INTO email_timeline (email_id, kind, happened_at, detail) VALUES (?1, ?2, ?3, ?4)",
                    params![email_id, timeline_entry.kind, timeline_entry.happened_at_unix_ms, timeline_entry.detail],
                )?;
                let click_count: i64 = transaction.query_row(
                    "SELECT count(*) FROM email_clicks WHERE email_id = ?1",
                    [&email_id],
                    |row| row.get(0),
                )?;
                transaction.commit()?;
                Ok(Some(RecordedEmailClick {
                    is_first_click: earlier_clicks_on_link == 0,
                    click_count: u64::try_from(click_count).unwrap_or_default(),
                }))
            })
            .await
    }

    /// The email's clicks, newest first.
    pub async fn list_clicks(&self, email_id: &str) -> Result<Vec<EmailClickRecord>, StoreError> {
        let email_id = email_id.to_owned();
        self.database()
            .read(move |connection| {
                let mut statement = connection.prepare(
                    "SELECT clicked_at, url, source, user_agent FROM email_clicks WHERE email_id = ?1 ORDER BY clicked_at DESC, rowid DESC",
                )?;
                Ok(statement
                    .query_map([email_id], |row| {
                        Ok(EmailClickRecord {
                            clicked_at_unix_ms: row.get(0)?,
                            url: row.get(1)?,
                            source: row.get(2)?,
                            user_agent: row.get(3)?,
                        })
                    })?
                    .collect::<rusqlite::Result<Vec<_>>>()?)
            })
            .await
    }

    pub async fn count_clicks(&self, email_id: &str) -> Result<u64, StoreError> {
        let email_id = email_id.to_owned();
        self.database()
            .read(move |connection| {
                let click_count: i64 = connection.query_row(
                    "SELECT count(*) FROM email_clicks WHERE email_id = ?1",
                    [email_id],
                    |row| row.get(0),
                )?;
                Ok(u64::try_from(click_count).unwrap_or_default())
            })
            .await
    }
}
