use std::sync::Arc;

use rusqlite::{OptionalExtension, params};

use super::SeedStateRecord;
use crate::{Database, StoreError};

/// The one seed state row.
#[derive(Clone)]
pub struct SeedStateRepository {
    database: Arc<Database>,
}

impl SeedStateRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Replaces the stored seed state.
    pub async fn save_state(&self, seed_state: SeedStateRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT INTO seed_state (id, seed_toml, source_path, applied_at, applied_items) \
                     VALUES (1, ?1, ?2, ?3, ?4) \
                     ON CONFLICT (id) DO UPDATE SET seed_toml = excluded.seed_toml, \
                     source_path = excluded.source_path, applied_at = excluded.applied_at, \
                     applied_items = excluded.applied_items",
                    params![
                        seed_state.seed_toml,
                        seed_state.source_path,
                        seed_state.applied_at_unix_ms,
                        seed_state.applied_items_json,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    /// The seed applied last; none when no seed was ever applied.
    pub async fn find_state(&self) -> Result<Option<SeedStateRecord>, StoreError> {
        self.database
            .read(|connection| {
                Ok(connection
                    .query_row(
                        "SELECT seed_toml, source_path, applied_at, applied_items FROM seed_state WHERE id = 1",
                        [],
                        |row| {
                            Ok(SeedStateRecord {
                                seed_toml: row.get(0)?,
                                source_path: row.get(1)?,
                                applied_at_unix_ms: row.get(2)?,
                                applied_items_json: row.get(3)?,
                            })
                        },
                    )
                    .optional()?)
            })
            .await
    }
}
