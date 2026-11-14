use rusqlite::params;

use super::{EmailRepository, TimelineRecord};
use crate::message_open::{EMAIL_OPENS, insert_open, list_opens};
use crate::{MessageOpenRecord, OpenRecording, StoreError};

impl EmailRepository {
    /// Records the open and adds it to the timeline in one transaction; answers the new open
    /// count, or `None` when nothing was recorded.
    pub async fn record_open(
        &self,
        email_id: &str,
        email_open: MessageOpenRecord,
        timeline_entry: TimelineRecord,
        open_recording: OpenRecording,
    ) -> Result<Option<u64>, StoreError> {
        let email_id = email_id.to_owned();
        self.database()
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let new_open_count = insert_open(
                    &transaction,
                    &EMAIL_OPENS,
                    &email_id,
                    &email_open,
                    open_recording,
                )?;
                if new_open_count.is_some() {
                    transaction.execute(
                        "INSERT INTO email_timeline (email_id, kind, happened_at, detail) VALUES (?1, ?2, ?3, ?4)",
                        params![email_id, timeline_entry.kind, timeline_entry.happened_at_unix_ms, timeline_entry.detail],
                    )?;
                }
                transaction.commit()?;
                Ok(new_open_count)
            })
            .await
    }

    /// The email's opens, oldest first.
    pub async fn list_opens(&self, email_id: &str) -> Result<Vec<MessageOpenRecord>, StoreError> {
        let email_id = email_id.to_owned();
        self.database()
            .read(move |connection| Ok(list_opens(connection, &EMAIL_OPENS, &email_id)?))
            .await
    }
}
