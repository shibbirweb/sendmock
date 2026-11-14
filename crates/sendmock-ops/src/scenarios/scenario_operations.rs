use super::scenario_file::validate_scenario_file;
use super::scenario_runner::{build_step_operations, run_scenario};
use super::scenario_wire::{ScenarioReport, ScenarioRequest, ScenarioValidation};
use crate::{
    CliArgument, HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
    build_operation_registry,
};

const SCENARIO_FILE_ARGUMENT: &[CliArgument] = &[CliArgument {
    placeholder: "file",
    input_name: "scenario",
    reads_file: true,
}];

pub struct ValidateScenarioOperation;

impl Operation for ValidateScenarioOperation {
    type Input = ScenarioRequest;
    type Output = ScenarioValidation;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postScenariosValidate",
            method: HttpMethod::Post,
            path: "/api/v1/scenarios/validate",
            summary: "Check a scenario file without running it.",
            is_read_only: true,
            cli_usage: "sendmock scenario validate <file>",
            mcp_tool: "sendmock_scenario_validate",
            cli_arguments: SCENARIO_FILE_ARGUMENT,
            success_flag_field: Some("is_valid"),
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Reports problems without running anything (AI-04.2).
    async fn execute(
        &self,
        _operation_context: &OperationContext,
        input: ScenarioRequest,
    ) -> Result<ScenarioValidation, OperationError> {
        let step_operations = build_step_operations(&build_operation_registry());
        Ok(validate_scenario_file(&input.scenario, &|step_name| {
            step_operations.contains_key(step_name)
        }))
    }
}

pub struct RunScenarioOperation;

impl Operation for RunScenarioOperation {
    type Input = ScenarioRequest;
    type Output = ScenarioReport;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postScenariosRun",
            method: HttpMethod::Post,
            path: "/api/v1/scenarios/run",
            summary: "Run a scenario file step by step and report each step.",
            cli_usage: "sendmock scenario run <file>",
            mcp_tool: "sendmock_scenario_run",
            cli_arguments: SCENARIO_FILE_ARGUMENT,
            success_flag_field: Some("is_passed"),
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Steps run in order; the CLI exits `5` when an `assert` fails (AI-04.1).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ScenarioRequest,
    ) -> Result<ScenarioReport, OperationError> {
        run_scenario(
            operation_context,
            &build_operation_registry(),
            &input.scenario,
        )
        .await
    }
}
