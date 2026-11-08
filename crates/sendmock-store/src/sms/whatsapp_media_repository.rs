use std::sync::Arc;

use rusqlite::{OptionalExtension, params};

use crate::{Database, StoreError};

/// A file uploaded to the WhatsApp Cloud API's media endpoint.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WhatsappMediaRecord {
    pub media_id: String,
    pub phone_number_id: String,
    pub mime_type: String,
    pub file_name: Option<String>,
    /// Hex SHA-256 of the content, as Meta answers it.
    pub sha256: String,
    pub content: Vec<u8>,
    pub project_key: String,
    pub created_at_unix_ms: i64,
}

/// Uploaded WhatsApp media, kept until it is deleted, pruned with the messages or reset.
#[derive(Clone)]
pub struct WhatsappMediaRepository {
    database: Arc<Database>,
}

impl WhatsappMediaRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn insert_media(&self, media: WhatsappMediaRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT INTO whatsapp_media (id, phone_number_id, mime_type, file_name, sha256, file_size, content, project_key, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        media.media_id,
                        media.phone_number_id,
                        media.mime_type,
                        media.file_name,
                        media.sha256,
                        i64::try_from(media.content.len()).unwrap_or(i64::MAX),
                        media.content,
                        media.project_key,
                        media.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn find_media(
        &self,
        media_id: &str,
    ) -> Result<Option<WhatsappMediaRecord>, StoreError> {
        let media_id = media_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        "SELECT id, phone_number_id, mime_type, file_name, sha256, content, project_key, created_at \
                         FROM whatsapp_media WHERE id = ?1",
                        [media_id],
                        |row| {
                            Ok(WhatsappMediaRecord {
                                media_id: row.get(0)?,
                                phone_number_id: row.get(1)?,
                                mime_type: row.get(2)?,
                                file_name: row.get(3)?,
                                sha256: row.get(4)?,
                                content: row.get(5)?,
                                project_key: row.get(6)?,
                                created_at_unix_ms: row.get(7)?,
                            })
                        },
                    )
                    .optional()?)
            })
            .await
    }

    /// Answers whether the media existed.
    pub async fn delete_media(&self, media_id: &str) -> Result<bool, StoreError> {
        let media_id = media_id.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection.execute("DELETE FROM whatsapp_media WHERE id = ?1", [media_id])? > 0)
            })
            .await
    }

    pub async fn delete_all_media(&self) -> Result<(), StoreError> {
        self.database
            .write(|connection| {
                connection.execute("DELETE FROM whatsapp_media", [])?;
                Ok(())
            })
            .await
    }
}
