use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::{WebhookTemplateRecord, WebhookTemplateRevisionRecord};
use crate::{Database, StoreError};

const TEMPLATE_COLUMNS: &str = "id, source, name, service, description, events_json, required_variables_json, method, content_type, header_templates_json, body_template, revision, updated_at";

/// Custom and edited built-in webhook templates, with their saved revisions.
#[derive(Clone)]
pub struct WebhookTemplateRepository {
    database: Arc<Database>,
}

impl WebhookTemplateRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn list_templates(&self) -> Result<Vec<WebhookTemplateRecord>, StoreError> {
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {TEMPLATE_COLUMNS} FROM webhook_templates ORDER BY rowid"
                ))?;
                let stored_templates = statement
                    .query_map([], read_template_row)?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(stored_templates)
            })
            .await
    }

    pub async fn find_template(
        &self,
        template_id: &str,
    ) -> Result<Option<WebhookTemplateRecord>, StoreError> {
        let template_id = template_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {TEMPLATE_COLUMNS} FROM webhook_templates WHERE id = ?1"),
                        [template_id],
                        read_template_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Inserts the template, or replaces the stored one with the same id.
    pub async fn save_template(
        &self,
        saved_template: WebhookTemplateRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!(
                        "INSERT INTO webhook_templates ({TEMPLATE_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13) \
                         ON CONFLICT (id) DO UPDATE SET source = ?2, name = ?3, service = ?4, description = ?5, events_json = ?6, required_variables_json = ?7, method = ?8, content_type = ?9, header_templates_json = ?10, body_template = ?11, revision = ?12, updated_at = ?13"
                    ),
                    params![
                        saved_template.template_id,
                        saved_template.source,
                        saved_template.name,
                        saved_template.service,
                        saved_template.description,
                        saved_template.events_json,
                        saved_template.required_variables_json,
                        saved_template.method,
                        saved_template.content_type,
                        saved_template.header_templates_json,
                        saved_template.body_template,
                        saved_template.revision,
                        saved_template.updated_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    /// Deletes the template and its revisions. False when there was no row.
    pub async fn delete_template(&self, template_id: &str) -> Result<bool, StoreError> {
        let template_id = template_id.to_owned();
        self.database
            .write(move |connection| {
                connection.execute(
                    "DELETE FROM webhook_template_revisions WHERE template_id = ?1",
                    [&template_id],
                )?;
                let deleted_count = connection.execute(
                    "DELETE FROM webhook_templates WHERE id = ?1",
                    [&template_id],
                )?;
                Ok(deleted_count > 0)
            })
            .await
    }

    /// Keeps a revision and drops the oldest beyond `kept_count`.
    pub async fn insert_revision(
        &self,
        new_revision: WebhookTemplateRevisionRecord,
        kept_count: u32,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    "INSERT OR REPLACE INTO webhook_template_revisions (template_id, revision, saved_at, template_json) VALUES (?1, ?2, ?3, ?4)",
                    params![
                        new_revision.template_id,
                        new_revision.revision,
                        new_revision.saved_at_unix_ms,
                        new_revision.template_json,
                    ],
                )?;
                connection.execute(
                    "DELETE FROM webhook_template_revisions WHERE template_id = ?1 AND revision NOT IN \
                     (SELECT revision FROM webhook_template_revisions WHERE template_id = ?1 ORDER BY revision DESC LIMIT ?2)",
                    params![new_revision.template_id, kept_count],
                )?;
                Ok(())
            })
            .await
    }

    /// The kept revisions, newest first.
    pub async fn list_revisions(
        &self,
        template_id: &str,
    ) -> Result<Vec<WebhookTemplateRevisionRecord>, StoreError> {
        let template_id = template_id.to_owned();
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(
                    "SELECT template_id, revision, saved_at, template_json FROM webhook_template_revisions WHERE template_id = ?1 ORDER BY revision DESC",
                )?;
                let stored_revisions = statement
                    .query_map([template_id], |row| {
                        Ok(WebhookTemplateRevisionRecord {
                            template_id: row.get(0)?,
                            revision: row.get(1)?,
                            saved_at_unix_ms: row.get(2)?,
                            template_json: row.get(3)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(stored_revisions)
            })
            .await
    }
}

fn read_template_row(row: &Row<'_>) -> rusqlite::Result<WebhookTemplateRecord> {
    Ok(WebhookTemplateRecord {
        template_id: row.get(0)?,
        source: row.get(1)?,
        name: row.get(2)?,
        service: row.get(3)?,
        description: row.get(4)?,
        events_json: row.get(5)?,
        required_variables_json: row.get(6)?,
        method: row.get(7)?,
        content_type: row.get(8)?,
        header_templates_json: row.get(9)?,
        body_template: row.get(10)?,
        revision: row.get(11)?,
        updated_at_unix_ms: row.get(12)?,
    })
}
