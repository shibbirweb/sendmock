use sendmock_store::ProjectRecord;

use super::project_checks::{
    check_project_key, check_project_name, find_project_or_not_found, project_not_found,
    refuse_default_project,
};
use super::project_inputs::{ProjectInput, ProjectReference, ProjectUpdate};
use super::project_views::Project;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

pub struct ListProjectsOperation;

impl Operation for ListProjectsOperation {
    type Input = NoInput;
    type Output = Vec<Project>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getProjects",
            method: HttpMethod::Get,
            path: "/api/v1/projects",
            summary: "Every project, default first, with the traffic each holds.",
            is_read_only: true,
            cli_usage: "sendmock projects list",
            mcp_tool: "sendmock_project_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<Project>, OperationError> {
        let stored_projects = operation_context.project_repository.list_projects().await?;
        Ok(stored_projects.into_iter().map(Project::from).collect())
    }
}

pub struct CreateProjectOperation;

impl Operation for CreateProjectOperation {
    type Input = ProjectInput;
    type Output = Project;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postProjects",
            method: HttpMethod::Post,
            path: "/api/v1/projects",
            summary: "Add a project that apps can send traffic to by its key.",
            cli_usage: "sendmock projects create",
            mcp_tool: "sendmock_project_create",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProjectInput,
    ) -> Result<Project, OperationError> {
        let project_key = input.key.trim().to_owned();
        check_project_key(&project_key)?;
        check_project_name(&input.name)?;
        let new_project = ProjectRecord {
            project_key: project_key.clone(),
            name: input.name.trim().to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
            ..ProjectRecord::default()
        };
        if !operation_context
            .project_repository
            .insert_project(new_project)
            .await?
        {
            return Err(OperationError::Conflict {
                code: "project_exists",
                message: format!("A project with key {project_key} already exists"),
            });
        }
        Ok(Project::from(
            find_project_or_not_found(operation_context, &project_key).await?,
        ))
    }
}

pub struct UpdateProjectOperation;

impl Operation for UpdateProjectOperation {
    type Input = ProjectUpdate;
    type Output = Project;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchProjectsByProjectKey",
            method: HttpMethod::Patch,
            path: "/api/v1/projects/{projectKey}",
            summary: "Rename a project; its key stays the same.",
            cli_usage: "sendmock projects update <projectKey>",
            mcp_tool: "sendmock_project_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProjectUpdate,
    ) -> Result<Project, OperationError> {
        check_project_name(&input.name)?;
        if !operation_context
            .project_repository
            .rename_project(&input.project_key, input.name.trim())
            .await?
        {
            return Err(project_not_found(&input.project_key));
        }
        Ok(Project::from(
            find_project_or_not_found(operation_context, &input.project_key).await?,
        ))
    }
}

pub struct DeleteProjectOperation;

impl Operation for DeleteProjectOperation {
    type Input = ProjectReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteProjectsByProjectKey",
            method: HttpMethod::Delete,
            path: "/api/v1/projects/{projectKey}",
            summary: "Delete a project with its emails, SMS and verifications.",
            is_destructive: true,
            cli_usage: "sendmock projects delete <projectKey>",
            mcp_tool: "sendmock_project_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProjectReference,
    ) -> Result<NoContent, OperationError> {
        refuse_default_project(&input.project_key)?;
        operation_context
            .project_repository
            .delete_project_with_traffic(&input.project_key)
            .await?
            .ok_or_else(|| project_not_found(&input.project_key))?;
        Ok(NoContent)
    }
}
