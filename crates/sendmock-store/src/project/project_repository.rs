use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use super::{DeletedProjectTraffic, ProjectRecord};
use crate::{Database, StoreError};

/// The project that holds traffic sent to no other; made by the migration, never deleted.
pub const DEFAULT_PROJECT_KEY: &str = "default";

/// The project columns, with the traffic counts read alongside.
const PROJECT_SELECT: &str = "SELECT p.project_key, p.name, p.created_at, \
     (SELECT COUNT(*) FROM emails e WHERE e.project_key = p.project_key), \
     (SELECT COUNT(*) FROM sms_messages s WHERE s.project_key = p.project_key), \
     (SELECT COUNT(*) FROM verifications v WHERE v.project_key = p.project_key) \
     FROM projects p";

fn read_count(row: &Row<'_>, column_index: usize) -> rusqlite::Result<u64> {
    Ok(u64::try_from(row.get::<_, i64>(column_index)?).unwrap_or_default())
}

fn read_project_row(row: &Row<'_>) -> rusqlite::Result<ProjectRecord> {
    Ok(ProjectRecord {
        project_key: row.get(0)?,
        name: row.get(1)?,
        created_at_unix_ms: row.get(2)?,
        email_count: read_count(row, 3)?,
        sms_count: read_count(row, 4)?,
        verification_count: read_count(row, 5)?,
    })
}

fn count_deleted(deleted_rows: usize) -> u64 {
    u64::try_from(deleted_rows).unwrap_or_default()
}

/// Projects and the captured traffic each one holds.
#[derive(Clone)]
pub struct ProjectRepository {
    database: Arc<Database>,
}

impl ProjectRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Every project, `default` first, then in the order they were made.
    pub async fn list_projects(&self) -> Result<Vec<ProjectRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(&format!(
                    "{PROJECT_SELECT} ORDER BY p.project_key != 'default', p.created_at, p.rowid"
                ))?;
                let projects = statement
                    .query_map([], read_project_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(projects)
            })
            .await
    }

    pub async fn find_project(
        &self,
        project_key: &str,
    ) -> Result<Option<ProjectRecord>, StoreError> {
        let project_key = project_key.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("{PROJECT_SELECT} WHERE p.project_key = ?1"),
                        [project_key],
                        read_project_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Whether a project has this key; cheaper than `find_project`, which counts its traffic.
    pub async fn has_project(&self, project_key: &str) -> Result<bool, StoreError> {
        let project_key = project_key.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        "SELECT 1 FROM projects WHERE project_key = ?1",
                        [project_key],
                        |_| Ok(()),
                    )
                    .optional()?
                    .is_some())
            })
            .await
    }

    /// Adds the project unless its key is taken; answers whether it was added.
    pub async fn insert_project(&self, new_project: ProjectRecord) -> Result<bool, StoreError> {
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "INSERT OR IGNORE INTO projects (project_key, name, created_at) VALUES (?1, ?2, ?3)",
                    params![
                        new_project.project_key,
                        new_project.name,
                        new_project.created_at_unix_ms
                    ],
                )? > 0)
            })
            .await
    }

    /// Answers whether the project exists.
    pub async fn rename_project(&self, project_key: &str, name: &str) -> Result<bool, StoreError> {
        let (project_key, name) = (project_key.to_owned(), name.to_owned());
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "UPDATE projects SET name = ?2 WHERE project_key = ?1",
                    params![project_key, name],
                )? > 0)
            })
            .await
    }

    /// Deletes the project and its emails, SMS and verifications in one write; their child
    /// rows go with them through their cascading keys. Answers `None` when there is no such
    /// project.
    pub async fn delete_project_with_traffic(
        &self,
        project_key: &str,
    ) -> Result<Option<DeletedProjectTraffic>, StoreError> {
        let project_key = project_key.to_owned();
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let deleted_traffic = DeletedProjectTraffic {
                    email_count: count_deleted(
                        transaction
                            .execute("DELETE FROM emails WHERE project_key = ?1", [&project_key])?,
                    ),
                    sms_count: count_deleted(transaction.execute(
                        "DELETE FROM sms_messages WHERE project_key = ?1",
                        [&project_key],
                    )?),
                    verification_count: count_deleted(transaction.execute(
                        "DELETE FROM verifications WHERE project_key = ?1",
                        [&project_key],
                    )?),
                };
                transaction.execute(
                    "DELETE FROM push_notifications WHERE project_key = ?1",
                    [&project_key],
                )?;
                let is_deleted = transaction.execute(
                    "DELETE FROM projects WHERE project_key = ?1",
                    [&project_key],
                )? > 0;
                if !is_deleted {
                    return Ok(None);
                }
                transaction.commit()?;
                Ok(Some(deleted_traffic))
            })
            .await
    }
}
