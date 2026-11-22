use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use crate::{Database, StoreError};

/// A bin attached to a provider, with the bin's name read with it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderBinRecord {
    /// `email`, `sms`, `push` or `payments`.
    pub area: String,
    pub provider_key: String,
    pub bin_id: String,
    pub bin_name: String,
    pub created_at_unix_ms: i64,
}

const PROVIDER_BIN_SELECT: &str = "SELECT p.area, p.provider_key, p.bin_id, b.name, p.created_at \
     FROM provider_bins p JOIN http_bins b ON b.id = p.bin_id";

fn read_provider_bin_row(row: &Row<'_>) -> rusqlite::Result<ProviderBinRecord> {
    Ok(ProviderBinRecord {
        area: row.get(0)?,
        provider_key: row.get(1)?,
        bin_id: row.get(2)?,
        bin_name: row.get(3)?,
        created_at_unix_ms: row.get(4)?,
    })
}

/// Which bin, if any, takes the requests each provider does not answer itself.
#[derive(Clone)]
pub struct ProviderBinRepository {
    database: Arc<Database>,
}

impl ProviderBinRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Every attachment, by area and provider key.
    pub async fn list_provider_bins(&self) -> Result<Vec<ProviderBinRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(&format!(
                    "{PROVIDER_BIN_SELECT} ORDER BY p.area, p.provider_key"
                ))?;
                let provider_bins = statement
                    .query_map([], read_provider_bin_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(provider_bins)
            })
            .await
    }

    pub async fn find_provider_bin(
        &self,
        area: &str,
        provider_key: &str,
    ) -> Result<Option<ProviderBinRecord>, StoreError> {
        let area = area.to_owned();
        let provider_key = provider_key.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("{PROVIDER_BIN_SELECT} WHERE p.area = ?1 AND p.provider_key = ?2"),
                        [area, provider_key],
                        read_provider_bin_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Attaches the bin, replacing the provider's earlier one.
    pub async fn save_provider_bin(
        &self,
        area: &str,
        provider_key: &str,
        bin_id: &str,
        created_at_unix_ms: i64,
    ) -> Result<(), StoreError> {
        let area = area.to_owned();
        let provider_key = provider_key.to_owned();
        let bin_id = bin_id.to_owned();
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT INTO provider_bins (area, provider_key, bin_id, created_at) VALUES (?1, ?2, ?3, ?4) \
                     ON CONFLICT (area, provider_key) DO UPDATE SET bin_id = excluded.bin_id, created_at = excluded.created_at",
                    params![area, provider_key, bin_id, created_at_unix_ms],
                )?;
                Ok(())
            })
            .await
    }

    /// Detaches the provider's bin; `false` when it had none.
    pub async fn delete_provider_bin(
        &self,
        area: &str,
        provider_key: &str,
    ) -> Result<bool, StoreError> {
        let area = area.to_owned();
        let provider_key = provider_key.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "DELETE FROM provider_bins WHERE area = ?1 AND provider_key = ?2",
                    [area, provider_key],
                )? > 0)
            })
            .await
    }

    /// Removes every attachment, as a reset or a Replace import does.
    pub async fn delete_all_provider_bins(&self) -> Result<(), StoreError> {
        self.database
            .write(|connection| {
                connection.execute("DELETE FROM provider_bins", [])?;
                Ok(())
            })
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DatabaseLocation, EMBEDDED_MIGRATIONS, HttpBinRecord, HttpBinRepository};

    async fn insert_bin(database: &Arc<Database>, bin_id: &str, bin_name: &str) {
        let bin_repository = HttpBinRepository::new(database.clone());
        let new_bin = HttpBinRecord {
            bin_id: bin_id.to_owned(),
            name: bin_name.to_owned(),
            preset: None,
            default_response_json: "{}".to_owned(),
            rules_json: "[]".to_owned(),
            created_at_unix_ms: 1,
            request_count: 0,
            last_request_at_unix_ms: None,
        };
        let _ = bin_repository.insert_bin_once(new_bin).await;
    }

    #[tokio::test]
    async fn a_provider_keeps_one_bin_and_a_deleted_bin_detaches_it() -> Result<(), StoreError> {
        let database = Arc::new(Database::open(
            DatabaseLocation::InMemory,
            EMBEDDED_MIGRATIONS,
        )?);
        insert_bin(&database, "bin1", "twilio-gaps").await;
        insert_bin(&database, "bin2", "other").await;
        let provider_bins = ProviderBinRepository::new(database.clone());

        provider_bins
            .save_provider_bin("sms", "twilio", "bin1", 10)
            .await?;
        provider_bins
            .save_provider_bin("sms", "twilio", "bin2", 20)
            .await?;
        let attached = provider_bins.find_provider_bin("sms", "twilio").await?;
        HttpBinRepository::new(database.clone())
            .delete_bin("bin2")
            .await?;

        assert_eq!(
            attached.map(|record| record.bin_name),
            Some("other".to_owned())
        );
        assert_eq!(
            provider_bins.find_provider_bin("sms", "twilio").await?,
            None
        );
        assert!(provider_bins.list_provider_bins().await?.is_empty());
        Ok(())
    }
}
