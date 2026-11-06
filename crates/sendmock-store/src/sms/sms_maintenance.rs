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

    /// Records that the recipient read the message; false when it is gone.
    pub async fn record_read_receipt(
        &self,
        sms_id: &str,
        read_at_unix_ms: i64,
    ) -> Result<bool, StoreError> {
        let sms_id = sms_id.to_owned();
        self.database()
            .write(move |connection| {
                Ok(connection.execute(
                    "UPDATE sms_messages SET opened_at = COALESCE(opened_at, ?2), open_count = open_count + 1, updated_at = ?2 WHERE id = ?1",
                    params![sms_id, read_at_unix_ms],
                )? > 0)
            })
            .await
    }
}
