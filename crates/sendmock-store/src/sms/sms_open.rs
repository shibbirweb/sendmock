use super::SmsRepository;
use crate::message_open::{SMS_OPENS, insert_open, list_opens};
use crate::{MessageOpenRecord, OpenRecording, StoreError};

impl SmsRepository {
    /// Records a read of the message; answers the new open count, or `None` when nothing was
    /// recorded.
    pub async fn record_open(
        &self,
        sms_id: &str,
        sms_open: MessageOpenRecord,
        open_recording: OpenRecording,
    ) -> Result<Option<u64>, StoreError> {
        let sms_id = sms_id.to_owned();
        self.database()
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let new_open_count =
                    insert_open(&transaction, &SMS_OPENS, &sms_id, &sms_open, open_recording)?;
                transaction.commit()?;
                Ok(new_open_count)
            })
            .await
    }

    /// The message's reads, oldest first.
    pub async fn list_opens(&self, sms_id: &str) -> Result<Vec<MessageOpenRecord>, StoreError> {
        let sms_id = sms_id.to_owned();
        self.database()
            .read(move |connection| Ok(list_opens(connection, &SMS_OPENS, &sms_id)?))
            .await
    }
}
