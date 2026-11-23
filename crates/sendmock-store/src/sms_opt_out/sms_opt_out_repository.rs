use std::sync::Arc;

use rusqlite::{Row, params, params_from_iter};

use crate::{Database, StoreError};

/// A contact who opted out of one sender's messages.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmsOptOutRecord {
    /// Your app's number, or the SID of the Messaging Service it is in.
    pub sender: String,
    pub contact_number: String,
    /// The keyword the contact texted, as they wrote it.
    pub keyword: String,
    pub created_at_unix_ms: i64,
}

/// Opt-outs per sender and contact.
#[derive(Clone)]
pub struct SmsOptOutRepository {
    database: Arc<Database>,
}

fn read_opt_out_row(row: &Row<'_>) -> rusqlite::Result<SmsOptOutRecord> {
    Ok(SmsOptOutRecord {
        sender: row.get(0)?,
        contact_number: row.get(1)?,
        keyword: row.get(2)?,
        created_at_unix_ms: row.get(3)?,
    })
}

impl SmsOptOutRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Every opt-out, newest first.
    pub async fn list_opt_outs(&self) -> Result<Vec<SmsOptOutRecord>, StoreError> {
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(
                    "SELECT sender, contact_number, keyword, created_at FROM sms_opt_outs \
                     ORDER BY created_at DESC, sender, contact_number",
                )?;
                let opt_outs = statement
                    .query_map([], read_opt_out_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(opt_outs)
            })
            .await
    }

    /// Whether the contact opted out of any of these senders.
    pub async fn is_opted_out(
        &self,
        senders: Vec<String>,
        contact_number: &str,
    ) -> Result<bool, StoreError> {
        if senders.is_empty() {
            return Ok(false);
        }
        let contact_number = contact_number.to_owned();
        self.database
            .read(move |connection| {
                let placeholders = vec!["?"; senders.len()].join(", ");
                let mut parameters = senders;
                parameters.push(contact_number);
                let matching_count: i64 = connection.query_row(
                    &format!(
                        "SELECT count(*) FROM sms_opt_outs WHERE sender IN ({placeholders}) AND contact_number = ?"
                    ),
                    params_from_iter(parameters.iter()),
                    |row| row.get(0),
                )?;
                Ok(matching_count > 0)
            })
            .await
    }

    /// Adds the opt-out, or replaces the keyword and time of one already listed.
    pub async fn save_opt_out(&self, opt_out: SmsOptOutRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT OR REPLACE INTO sms_opt_outs (sender, contact_number, keyword, created_at) VALUES (?1, ?2, ?3, ?4)",
                    params![
                        opt_out.sender,
                        opt_out.contact_number,
                        opt_out.keyword,
                        opt_out.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    /// Lifts one opt-out; whether there was one.
    pub async fn delete_opt_out(
        &self,
        sender: &str,
        contact_number: &str,
    ) -> Result<bool, StoreError> {
        let (sender, contact_number) = (sender.to_owned(), contact_number.to_owned());
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "DELETE FROM sms_opt_outs WHERE sender = ?1 AND contact_number = ?2",
                    params![sender, contact_number],
                )? > 0)
            })
            .await
    }

    /// Lifts every opt-out; how many there were.
    pub async fn delete_all_opt_outs(&self) -> Result<u64, StoreError> {
        self.database
            .write(move |connection| {
                let removed_count = connection.execute("DELETE FROM sms_opt_outs", [])?;
                Ok(u64::try_from(removed_count).unwrap_or_default())
            })
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DatabaseLocation, EMBEDDED_MIGRATIONS};

    fn repository() -> SmsOptOutRepository {
        let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
            .unwrap_or_else(|open_error| panic!("{open_error}"));
        SmsOptOutRepository::new(Arc::new(database))
    }

    #[tokio::test]
    async fn an_opt_out_blocks_only_its_sender_until_it_is_lifted() -> Result<(), StoreError> {
        let repository = repository();
        repository
            .save_opt_out(SmsOptOutRecord {
                sender: "+15550001111".to_owned(),
                contact_number: "+15550002222".to_owned(),
                keyword: "STOP".to_owned(),
                created_at_unix_ms: 1,
            })
            .await?;

        let is_blocked = repository
            .is_opted_out(vec!["+15550001111".to_owned()], "+15550002222")
            .await?;
        let is_other_sender_blocked = repository
            .is_opted_out(vec!["+15550003333".to_owned()], "+15550002222")
            .await?;
        let was_lifted = repository
            .delete_opt_out("+15550001111", "+15550002222")
            .await?;

        assert!(is_blocked);
        assert!(!is_other_sender_blocked);
        assert!(was_lifted);
        assert!(repository.list_opt_outs().await?.is_empty());
        Ok(())
    }
}
