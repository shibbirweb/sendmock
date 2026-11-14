use rusqlite::params;

use super::{EmailRepository, TimelineRecord};
use crate::StoreError;

impl EmailRepository {
    /// Sets the email's delivery status and adds the event to its timeline in one
    /// transaction; false when the email is gone.
    pub async fn record_delivery_event(
        &self,
        email_id: &str,
        timeline_entry: TimelineRecord,
    ) -> Result<bool, StoreError> {
        let email_id = email_id.to_owned();
        self.database()
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let updated_count = transaction.execute(
                    "UPDATE emails SET delivery_status = ?2 WHERE id = ?1",
                    params![email_id, timeline_entry.kind],
                )?;
                if updated_count > 0 {
                    transaction.execute(
                        "INSERT INTO email_timeline (email_id, kind, happened_at, detail) VALUES (?1, ?2, ?3, ?4)",
                        params![email_id, timeline_entry.kind, timeline_entry.happened_at_unix_ms, timeline_entry.detail],
                    )?;
                }
                transaction.commit()?;
                Ok(updated_count > 0)
            })
            .await
    }
}
