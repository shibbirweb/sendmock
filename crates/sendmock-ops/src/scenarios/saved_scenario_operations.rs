use sendmock_store::SavedScenarioRecord;

use super::saved_scenario_checks::{check_scenario_file, check_scenario_name, find_saved_scenario};
use super::saved_scenario_wire::{
    SavedScenario, SavedScenarioInput, SavedScenarioReference, SavedScenarioUpdate,
};
use crate::{
    CliArgument, HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

pub struct ListSavedScenariosOperation;

impl Operation for ListSavedScenariosOperation {
    type Input = NoInput;
    type Output = Vec<SavedScenario>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getScenarios",
            method: HttpMethod::Get,
            path: "/api/v1/scenarios",
            summary: "The saved scenarios, by name.",
            is_read_only: true,
            cli_usage: "sendmock scenario list",
            mcp_tool: "sendmock_scenario_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<SavedScenario>, OperationError> {
        let stored_scenarios = operation_context.saved_scenarios.list_scenarios().await?;
        Ok(stored_scenarios
            .into_iter()
            .map(SavedScenario::from)
            .collect())
    }
}

pub struct GetSavedScenarioOperation;

impl Operation for GetSavedScenarioOperation {
    type Input = SavedScenarioReference;
    type Output = SavedScenario;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getScenariosByScenarioId",
            method: HttpMethod::Get,
            path: "/api/v1/scenarios/{scenarioId}",
            summary: "One saved scenario, by id or name.",
            is_read_only: true,
            cli_usage: "sendmock scenario show <scenarioId>",
            mcp_tool: "sendmock_scenario_get",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SavedScenarioReference,
    ) -> Result<SavedScenario, OperationError> {
        Ok(find_saved_scenario(operation_context, &input.scenario_id)
            .await?
            .into())
    }
}

pub struct SaveScenarioOperation;

impl Operation for SaveScenarioOperation {
    type Input = SavedScenarioInput;
    type Output = SavedScenario;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postScenarios",
            method: HttpMethod::Post,
            path: "/api/v1/scenarios",
            summary: "Save a scenario by name; 422 with its problems when it is not valid.",
            cli_usage: "sendmock scenario save <file>",
            mcp_tool: "sendmock_scenario_save",
            cli_arguments: &[CliArgument {
                placeholder: "file",
                input_name: "scenario",
                reads_file: true,
            }],
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SavedScenarioInput,
    ) -> Result<SavedScenario, OperationError> {
        let scenario_name = input.name.trim().to_owned();
        check_scenario_name(operation_context, &scenario_name, None).await?;
        check_scenario_file(&input.scenario)?;
        let now_unix_ms = operation_context.clock.now_unix_ms();
        let new_scenario = SavedScenarioRecord {
            scenario_id: operation_context.id_generator.generate_id().to_string(),
            name: scenario_name,
            description: input.description.trim().to_owned(),
            scenario_toml: input.scenario,
            created_by: operation_context.request.client.as_str().to_owned(),
            created_at_unix_ms: now_unix_ms,
            updated_at_unix_ms: now_unix_ms,
        };
        operation_context
            .saved_scenarios
            .save_scenario(new_scenario.clone())
            .await?;
        Ok(new_scenario.into())
    }
}

pub struct UpdateSavedScenarioOperation;

impl Operation for UpdateSavedScenarioOperation {
    type Input = SavedScenarioUpdate;
    type Output = SavedScenario;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchScenariosByScenarioId",
            method: HttpMethod::Patch,
            path: "/api/v1/scenarios/{scenarioId}",
            summary: "Rename a saved scenario or change its description or file.",
            cli_usage: "sendmock scenario update <scenarioId>",
            mcp_tool: "sendmock_scenario_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SavedScenarioUpdate,
    ) -> Result<SavedScenario, OperationError> {
        let stored_scenario = find_saved_scenario(operation_context, &input.scenario_id).await?;
        let scenario_name = input
            .name
            .map_or(stored_scenario.name.clone(), |name| name.trim().to_owned());
        check_scenario_name(
            operation_context,
            &scenario_name,
            Some(&stored_scenario.scenario_id),
        )
        .await?;
        if let Some(scenario_text) = &input.scenario {
            check_scenario_file(scenario_text)?;
        }
        let changed_scenario = SavedScenarioRecord {
            name: scenario_name,
            description: input
                .description
                .map_or(stored_scenario.description.clone(), |description| {
                    description.trim().to_owned()
                }),
            scenario_toml: input
                .scenario
                .unwrap_or_else(|| stored_scenario.scenario_toml.clone()),
            updated_at_unix_ms: operation_context.clock.now_unix_ms(),
            ..stored_scenario
        };
        operation_context
            .saved_scenarios
            .save_scenario(changed_scenario.clone())
            .await?;
        Ok(changed_scenario.into())
    }
}

pub struct DeleteSavedScenarioOperation;

impl Operation for DeleteSavedScenarioOperation {
    type Input = SavedScenarioReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteScenariosByScenarioId",
            method: HttpMethod::Delete,
            path: "/api/v1/scenarios/{scenarioId}",
            summary: "Delete a saved scenario.",
            is_destructive: true,
            cli_usage: "sendmock scenario delete <scenarioId>",
            mcp_tool: "sendmock_scenario_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SavedScenarioReference,
    ) -> Result<NoContent, OperationError> {
        let stored_scenario = find_saved_scenario(operation_context, &input.scenario_id).await?;
        operation_context
            .saved_scenarios
            .delete_scenario(&stored_scenario.scenario_id)
            .await?;
        Ok(NoContent)
    }
}
