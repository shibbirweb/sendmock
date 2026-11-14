use sendmock_store::{DEFAULT_PROJECT_KEY, ProjectRecord};
use serde::{Deserialize, Serialize};

use crate::projects::{check_project_key, check_project_name};
use crate::seed::seed_section_adapter::{
    SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::PROJECTS_SECTION;
use crate::{OperationContext, OperationError};

/// `[[projects]]`, matched by `key`. `default` always exists, so it is never written.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedProject {
    key: String,
    name: String,
}

pub struct ProjectSeedAdapter;

impl ProjectSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_project: SeedProject = read_seed_table(item_table)?;
        let project_key = seed_project.key.trim().to_owned();
        check_project_key(&project_key)?;
        check_project_name(&seed_project.name)?;
        let project_repository = &operation_context.project_repository;
        let is_added = project_repository
            .insert_project(ProjectRecord {
                project_key: project_key.clone(),
                name: seed_project.name.trim().to_owned(),
                created_at_unix_ms: operation_context.clock.now_unix_ms(),
                ..ProjectRecord::default()
            })
            .await?;
        if !is_added {
            project_repository
                .rename_project(&project_key, seed_project.name.trim())
                .await?;
        }
        Ok(project_key)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let stored_projects = operation_context.project_repository.list_projects().await?;
        stored_projects
            .into_iter()
            .filter(|stored_project| stored_project.project_key != DEFAULT_PROJECT_KEY)
            .map(|stored_project| {
                Ok(SeedItem {
                    item_key: stored_project.project_key.clone(),
                    item_name: stored_project.name.clone(),
                    table: write_seed_table(&SeedProject {
                        key: stored_project.project_key,
                        name: stored_project.name,
                    })?,
                })
            })
            .collect()
    }

    /// A reset restores exactly the seed's projects; their traffic is gone by then anyway.
    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let project_repository = &operation_context.project_repository;
        for stored_project in project_repository.list_projects().await? {
            let is_kept = stored_project.project_key == DEFAULT_PROJECT_KEY
                || kept_item_keys.contains(&stored_project.project_key);
            if !is_kept {
                project_repository
                    .delete_project_with_traffic(&stored_project.project_key)
                    .await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(ProjectSeedAdapter, PROJECTS_SECTION);
