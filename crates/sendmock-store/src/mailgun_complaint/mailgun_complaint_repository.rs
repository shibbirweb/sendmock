use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use crate::{Database, StoreError};

/// One address on a Mailgun domain's complaints table.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MailgunComplaintRecord {
    pub domain: String,
    pub address: String,
    pub created_at_unix_ms: i64,
}

/// Mailgun complaints, per sending domain and address.
#[derive(Clone)]
pub struct MailgunComplaintRepository {
    database: Arc<Database>,
}

fn read_complaint_row(row: &Row<'_>) -> rusqlite::Result<MailgunComplaintRecord> {
    Ok(MailgunComplaintRecord {
        domain: row.get(0)?,
        address: row.get(1)?,
        created_at_unix_ms: row.get(2)?,
    })
}

impl MailgunComplaintRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Every domain's complaints, by domain, oldest first; one domain's when given.
    pub async fn list_complaints(
        &self,
        domain: Option<&str>,
    ) -> Result<Vec<MailgunComplaintRecord>, StoreError> {
        let domain = domain.map(str::to_owned);
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(
                    "SELECT domain, address, created_at FROM mailgun_complaints \
                     WHERE ?1 IS NULL OR domain = ?1 ORDER BY domain, created_at, address",
                )?;
                let complaints = statement
                    .query_map([domain], read_complaint_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(complaints)
            })
            .await
    }

    pub async fn find_complaint(
        &self,
        domain: &str,
        address: &str,
    ) -> Result<Option<MailgunComplaintRecord>, StoreError> {
        let (domain, address) = (domain.to_owned(), address.to_lowercase());
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        "SELECT domain, address, created_at FROM mailgun_complaints WHERE domain = ?1 AND address = ?2",
                        params![domain, address],
                        read_complaint_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Adds the address, keeping the first complaint's time when it is already listed.
    pub async fn add_complaint(&self, complaint: MailgunComplaintRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT OR IGNORE INTO mailgun_complaints (domain, address, created_at) VALUES (?1, ?2, ?3)",
                    params![
                        complaint.domain,
                        complaint.address.to_lowercase(),
                        complaint.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn delete_complaint(&self, domain: &str, address: &str) -> Result<bool, StoreError> {
        let (domain, address) = (domain.to_owned(), address.to_lowercase());
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "DELETE FROM mailgun_complaints WHERE domain = ?1 AND address = ?2",
                    params![domain, address],
                )? > 0)
            })
            .await
    }

    /// Clears one domain's complaints; how many were removed.
    pub async fn delete_domain_complaints(&self, domain: &str) -> Result<u64, StoreError> {
        let domain = domain.to_owned();
        self.database
            .write(move |connection| {
                let removed_count = connection
                    .execute("DELETE FROM mailgun_complaints WHERE domain = ?1", [domain])?;
                Ok(u64::try_from(removed_count).unwrap_or_default())
            })
            .await
    }
}
