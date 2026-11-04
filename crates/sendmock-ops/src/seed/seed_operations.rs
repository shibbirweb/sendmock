use super::seed_application::apply_seed_toml;
use super::seed_export::write_seed_toml;
use super::seed_status::{SeedStatus, load_seed_status};
use super::{SeedFileRequest, SeedValidation};
use crate::{
    AnswerKind, CliArgument, FileAnswer, HttpMethod, NoInput, Operation, OperationContext,
    OperationDefinition, OperationError,
};

const SEED_FILE_NAME: &str = "sendmock.seed.toml";
const SEED_CONTENT_TYPE: &str = "application/toml";

pub struct GetSeedStatusOperation;

impl Operation for GetSeedStatusOperation {
    type Input = NoInput;
    type Output = SeedStatus;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getSeedStatus",
            method: HttpMethod::Get,
            path: "/api/v1/seed/status",
            summary: "Whether a seed file is loaded and when it was applied.",
            is_read_only: true,
            cli_usage: "sendmock seed status",
            mcp_tool: "sendmock_seed_status",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<SeedStatus, OperationError> {
        load_seed_status(operation_context).await
    }
}

pub struct ExportSeedOperation;

impl Operation for ExportSeedOperation {
    type Input = NoInput;
    type Output = FileAnswer;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getSeedExport",
            method: HttpMethod::Get,
            path: "/api/v1/seed/export",
            summary: "The current configuration as sendmock.seed.toml.",
            is_read_only: true,
            cli_usage: "sendmock seed export",
            mcp_tool: "sendmock_seed_export",
            answer_kind: AnswerKind::File {
                content_type: SEED_CONTENT_TYPE,
            },
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<FileAnswer, OperationError> {
        Ok(FileAnswer {
            content_type: SEED_CONTENT_TYPE.to_owned(),
            file_name: Some(SEED_FILE_NAME.to_owned()),
            bytes: write_seed_toml(operation_context).await?.into_bytes(),
        })
    }
}

pub struct ApplySeedOperation;

impl Operation for ApplySeedOperation {
    type Input = SeedFileRequest;
    type Output = SeedValidation;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSeedApply",
            method: HttpMethod::Post,
            path: "/api/v1/seed/apply",
            summary: "Apply a seed file; 422 with the errors when it is invalid.",
            cli_usage: "sendmock seed apply <file>",
            mcp_tool: "sendmock_seed_apply",
            cli_arguments: &[CliArgument {
                placeholder: "file",
                input_name: "seed_toml",
                reads_file: true,
            }],
            success_flag_field: Some("is_valid"),
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Creates or updates the file's items, matched by name or SID, so applying it twice
    /// changes nothing; it becomes the seed that reset restores.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SeedFileRequest,
    ) -> Result<SeedValidation, OperationError> {
        apply_seed_toml(operation_context, &input.seed_toml, None).await
    }
}
