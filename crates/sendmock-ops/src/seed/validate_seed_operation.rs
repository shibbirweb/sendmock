use super::{SeedFileRequest, SeedValidation, validate_seed_toml};
use crate::{
    CliArgument, HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
};

pub struct ValidateSeedOperation;

impl Operation for ValidateSeedOperation {
    type Input = SeedFileRequest;
    type Output = SeedValidation;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSeedValidate",
            method: HttpMethod::Post,
            path: "/api/v1/seed/validate",
            summary: "Check a seed file without applying it.",
            is_read_only: true,
            cli_usage: "sendmock seed validate <file>",
            mcp_tool: "sendmock_seed_validate",
            selector: None,
            cli_arguments: &[CliArgument {
                placeholder: "file",
                input_name: "seed_toml",
                reads_file: true,
            }],
            success_flag_field: Some("is_valid"),
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        _operation_context: &OperationContext,
        input: SeedFileRequest,
    ) -> Result<SeedValidation, OperationError> {
        Ok(validate_seed_toml(&input.seed_toml))
    }
}
