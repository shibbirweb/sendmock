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

    /// Deletes every message, or one project's; answers how many went.
    pub async fn delete_all_messages(
        &self,
        project_key: Option<String>,
    ) -> Result<u64, StoreError> {
        self.database()
            .write(move |connection| {
                let deleted_count = connection.execute(
                    "DELETE FROM sms_messages WHERE ?1 IS NULL OR project_key = ?1",
                    [project_key],
                )?;
                Ok(u64::try_from(deleted_count).unwrap_or_default())
            })
            .await
    }

    /// Deletes a conversation's messages; answers how many went.
    pub async fn delete_thread(&self, thread_id: &str) -> Result<u64, StoreError> {
        let thread_id = thread_id.to_owned();
        self.database()
            .write(move |connection| {
                let deleted_count = connection
                    .execute("DELETE FROM sms_messages WHERE thread_id = ?1", [thread_id])?;
                Ok(u64::try_from(deleted_count).unwrap_or_default())
            })
            .await
    }

    /// Marks every message of a thread read, as opening the conversation does; answers
    /// whether the thread has any message.
    pub async fn mark_thread_read(&self, thread_id: &str) -> Result<bool, StoreError> {
        let thread_id = thread_id.to_owned();
        self.database()
            .write(move |connection| {
                Ok(connection.execute(
                    "UPDATE sms_messages SET is_read = 1 WHERE thread_id = ?1",
                    [thread_id],
                )? > 0)
            })
            .await
    }

    /// Marks a thread's newest message unread, so even a thread of only sent messages can be
    /// flagged; answers whether the thread has any message.
    pub async fn mark_thread_unread(&self, thread_id: &str) -> Result<bool, StoreError> {
        let thread_id = thread_id.to_owned();
        self.database()
            .write(move |connection| {
                Ok(connection.execute(
                    "UPDATE sms_messages SET is_read = 0 WHERE id = \
                     (SELECT id FROM sms_messages WHERE thread_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 1)",
                    [thread_id],
                )? > 0)
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
