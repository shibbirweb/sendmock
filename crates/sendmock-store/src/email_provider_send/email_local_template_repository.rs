use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::EmailLocalTemplateRecord;
use crate::{Database, StoreError};

const TEMPLATE_COLUMNS: &str = "template_id, subject, text_body, html_body";

/// Local email templates from the seed file.
#[derive(Clone)]
pub struct EmailLocalTemplateRepository {
    database: Arc<Database>,
}

fn read_template_row(row: &Row<'_>) -> rusqlite::Result<EmailLocalTemplateRecord> {
    Ok(EmailLocalTemplateRecord {
        template_id: row.get(0)?,
        subject: row.get(1)?,
        text_body: row.get(2)?,
        html_body: row.get(3)?,
    })
}

impl EmailLocalTemplateRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Creates the template, or replaces the one with the same id.
    pub async fn save_template(
        &self,
        local_template: EmailLocalTemplateRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!(
                        "INSERT OR REPLACE INTO email_local_templates ({TEMPLATE_COLUMNS}) VALUES (?1, ?2, ?3, ?4)"
                    ),
                    params![
                        local_template.template_id,
                        local_template.subject,
                        local_template.text_body,
                        local_template.html_body,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn find_template(
        &self,
        template_id: &str,
    ) -> Result<Option<EmailLocalTemplateRecord>, StoreError> {
        let template_id = template_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!(
                            "SELECT {TEMPLATE_COLUMNS} FROM email_local_templates WHERE template_id = ?1"
                        ),
                        [template_id],
                        read_template_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Every template, by id.
    pub async fn list_templates(&self) -> Result<Vec<EmailLocalTemplateRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {TEMPLATE_COLUMNS} FROM email_local_templates ORDER BY template_id"
                ))?;
                let templates = statement
                    .query_map([], read_template_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(templates)
            })
            .await
    }

    pub async fn delete_template(&self, template_id: &str) -> Result<(), StoreError> {
        let template_id = template_id.to_owned();
        self.database
            .write(move |connection| {
                connection.execute(
                    "DELETE FROM email_local_templates WHERE template_id = ?1",
                    [template_id],
                )?;
                Ok(())
            })
            .await
    }
}
