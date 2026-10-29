use rusqlite::params;

use super::SmsRepository;
use crate::StoreError;

impl SmsRepository {
    pub async fn delete_message(&self, sms_id: &str) -> Result<bool, StoreError> {
        let sms_id = sms_id.to_owned();
        self.database()
            .write(move |connection| {
                Ok(connection.execute("DELETE FROM sms_messages WHERE id = ?1", [sms_id])? > 0)
            })
            .await
    }

    pub async fn delete_all_messages(&self) -> Result<u64, StoreError> {
        self.database()
            .write(|connection| Ok(connection.execute("DELETE FROM sms_messages", [])? as u64))
            .await
    }

    /// Marks a thread's inbound messages read, as opening the conversation does.
    pub async fn mark_thread_read(&self, thread_id: &str) -> Result<(), StoreError> {
        let thread_id = thread_id.to_owned();
        self.database()
            .write(move |connection| {
                connection.execute(
                    "UPDATE sms_messages SET is_read = 1 WHERE thread_id = ?1",
                    [thread_id],
                )?;
                Ok(())
            })
            .await
    }

    /// Keeps the newest `max_count` messages and drops those created before the cutoff.
    pub async fn prune_messages(
        &self,
        max_count: u64,
        created_before_unix_ms: Option<i64>,
    ) -> Result<u64, StoreError> {
        self.database()
            .write(move |connection| {
                let kept_count = i64::try_from(max_count).unwrap_or(i64::MAX);
                let mut deleted_count = connection.execute(
                    "DELETE FROM sms_messages WHERE id IN (SELECT id FROM sms_messages ORDER BY id DESC LIMIT -1 OFFSET ?1)",
                    params![kept_count],
                )?;
                if let Some(created_before_unix_ms) = created_before_unix_ms {
                    deleted_count +=
                        connection.execute("DELETE FROM sms_messages WHERE created_at < ?1", params![created_before_unix_ms])?;
                }
                Ok(deleted_count as u64)
            })
            .await
    }
}
