use super::ci_file::{CiFile, parse_ci_file};
use super::ci_runner::{read_ci_scenarios, run_ci_file};
use super::ci_wire::{CiFileRequest, CiReport, CiValidation};
use crate::{
    CliArgument, HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
    build_operation_registry,
};

/// `sendmock ci run <file>` and `ci validate <file>` send the file's text.
const CI_FILE_ARGUMENT: &[CliArgument] = &[CliArgument {
    placeholder: "file",
    input_name: "ci_file",
    reads_file: true,
    is_optional: false,
}];

fn read_ci_file(ci_text: &str) -> Result<CiFile, OperationError> {
    parse_ci_file(ci_text).map_err(|problems| OperationError::InvalidInput {
        message: problems.join("; "),
        field: Some("ci_file".to_owned()),
    })
}

pub struct RunCiOperation;

impl Operation for RunCiOperation {
    type Input = CiFileRequest;
    type Output = CiReport;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postCiRun",
            method: HttpMethod::Post,
            path: "/api/v1/ci/run",
            summary: "Run a CI file's setup and scenarios here and answer the report, with JUnit XML.",
            cli_usage: "sendmock ci run <file>",
            mcp_tool: "sendmock_ci_run",
            cli_arguments: CI_FILE_ARGUMENT,
            success_flag_field: Some("is_passed"),
            ..OperationDefinition::DEFAULTS
        }
    }

    /// A file that does not read, or a scenario with an unknown step, is refused before
    /// anything changes; the CLI exits `5` when a scenario fails.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: CiFileRequest,
    ) -> Result<CiReport, OperationError> {
        let ci_file = read_ci_file(&input.ci_file)?;
        run_ci_file(operation_context, &build_operation_registry(), &ci_file).await
    }
}

pub struct ValidateCiOperation;

impl Operation for ValidateCiOperation {
    type Input = CiFileRequest;
    type Output = CiValidation;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postCiValidate",
            method: HttpMethod::Post,
            path: "/api/v1/ci/validate",
            summary: "Check a CI file and its scenarios without running anything.",
            is_read_only: true,
            cli_usage: "sendmock ci validate <file>",
            mcp_tool: "sendmock_ci_validate",
            cli_arguments: CI_FILE_ARGUMENT,
            success_flag_field: Some("is_valid"),
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: CiFileRequest,
    ) -> Result<CiValidation, OperationError> {
        let ci_file = match parse_ci_file(&input.ci_file) {
            Ok(ci_file) => ci_file,
            Err(problems) => {
                return Ok(CiValidation {
                    is_valid: false,
                    scenario_count: 0,
                    problems,
                });
            }
        };
        let scenario_check =
            read_ci_scenarios(operation_context, &build_operation_registry(), &ci_file).await;
        Ok(CiValidation {
            is_valid: scenario_check.is_ok(),
            scenario_count: ci_file.scenarios.len(),
            problems: scenario_check
                .err()
                .map(|scenario_problem| vec![scenario_problem.to_string()])
                .unwrap_or_default(),
        })
    }
}
