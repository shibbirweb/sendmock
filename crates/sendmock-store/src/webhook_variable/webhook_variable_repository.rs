use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::WebhookVariableRecord;
use crate::{Database, StoreError};

const VARIABLE_COLUMNS: &str = "id, name, kind, endpoint_id, value, random_mode, fixed_value, description, created_by, created_at";

/// Webhook variables, global ones first, then by endpoint and name.
#[derive(Clone)]
pub struct WebhookVariableRepository {
    database: Arc<Database>,
}

impl WebhookVariableRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Every variable, or only one endpoint's own variables.
    pub async fn list_variables(
        &self,
        endpoint_id: Option<&str>,
    ) -> Result<Vec<WebhookVariableRecord>, StoreError> {
        let endpoint_id = endpoint_id.map(str::to_owned);
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {VARIABLE_COLUMNS} FROM webhook_variables WHERE ?1 IS NULL OR endpoint_id = ?1 ORDER BY endpoint_id IS NOT NULL, endpoint_id, name"
                ))?;
                let stored_variables = statement
                    .query_map([endpoint_id], read_variable_row)?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(stored_variables)
            })
            .await
    }

    /// The global variables and one endpoint's own, which is what its templates can read.
    pub async fn list_endpoint_scope_variables(
        &self,
        endpoint_id: &str,
    ) -> Result<Vec<WebhookVariableRecord>, StoreError> {
        let endpoint_id = endpoint_id.to_owned();
        self.database
            .read(move |connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {VARIABLE_COLUMNS} FROM webhook_variables WHERE endpoint_id IS NULL OR endpoint_id = ?1 ORDER BY endpoint_id IS NOT NULL, name"
                ))?;
                let stored_variables = statement
                    .query_map([endpoint_id], read_variable_row)?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(stored_variables)
            })
            .await
    }

    pub async fn find_variable(
        &self,
        variable_id: &str,
    ) -> Result<Option<WebhookVariableRecord>, StoreError> {
        let variable_id = variable_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {VARIABLE_COLUMNS} FROM webhook_variables WHERE id = ?1"),
                        [variable_id],
                        read_variable_row,
                    )
                    .optional()?)
            })
            .await
    }

    pub async fn insert_variable(
        &self,
        new_variable: WebhookVariableRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT INTO webhook_variables ({VARIABLE_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"),
                    params![
                        new_variable.variable_id,
                        new_variable.name,
                        new_variable.kind,
                        new_variable.endpoint_id,
                        new_variable.value,
                        new_variable.random_mode,
                        new_variable.fixed_value,
                        new_variable.description,
                        new_variable.created_by,
                        new_variable.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    /// Saves every field but the creator and creation time. False when the variable is gone.
    pub async fn update_variable(
        &self,
        changed_variable: WebhookVariableRecord,
    ) -> Result<bool, StoreError> {
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE webhook_variables SET name = ?2, kind = ?3, endpoint_id = ?4, value = ?5, random_mode = ?6, fixed_value = ?7, description = ?8 WHERE id = ?1",
                    params![
                        changed_variable.variable_id,
                        changed_variable.name,
                        changed_variable.kind,
                        changed_variable.endpoint_id,
                        changed_variable.value,
                        changed_variable.random_mode,
                        changed_variable.fixed_value,
                        changed_variable.description,
                    ],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    pub async fn delete_variable(&self, variable_id: &str) -> Result<bool, StoreError> {
        let variable_id = variable_id.to_owned();
        self.database
            .write(move |connection| {
                let deleted_count = connection
                    .execute("DELETE FROM webhook_variables WHERE id = ?1", [variable_id])?;
                Ok(deleted_count > 0)
            })
            .await
    }

    /// Deletes the own variables of a deleted endpoint.
    pub async fn delete_endpoint_variables(&self, endpoint_id: &str) -> Result<usize, StoreError> {
        let endpoint_id = endpoint_id.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "DELETE FROM webhook_variables WHERE endpoint_id = ?1",
                    [endpoint_id],
                )?)
            })
            .await
    }
}

fn read_variable_row(row: &Row<'_>) -> rusqlite::Result<WebhookVariableRecord> {
    Ok(WebhookVariableRecord {
        variable_id: row.get(0)?,
        name: row.get(1)?,
        kind: row.get(2)?,
        endpoint_id: row.get(3)?,
        value: row.get(4)?,
        random_mode: row.get(5)?,
        fixed_value: row.get(6)?,
        description: row.get(7)?,
        created_by: row.get(8)?,
        created_at_unix_ms: row.get(9)?,
    })
}
