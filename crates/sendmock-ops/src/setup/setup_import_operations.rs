use super::setup_source::resolve_setup_source;
use super::setup_validation::validate_setup;
use super::setup_wire::{SetupImportMode, SetupImportRequest, SetupValidation};
use crate::seed::{SetupImportOptions, apply_setup_text};
use crate::{
    CliArgument, HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
};

const SETUP_FILE_ARGUMENT: &[CliArgument] = &[CliArgument {
    placeholder: "file",
    input_name: "setup_text",
    reads_file: true,
    is_optional: true,
}];
const PASSPHRASE_ENVIRONMENT_INPUT: &[(&str, &str)] =
    &[("passphrase", "SENDMOCK_SETUP_PASSPHRASE")];

pub struct ValidateSetupOperation;

impl Operation for ValidateSetupOperation {
    type Input = SetupImportRequest;
    type Output = SetupValidation;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSetupValidate",
            method: HttpMethod::Post,
            path: "/api/v1/setup/validate",
            summary: "Check a setup without applying it, with what an import would add, change and remove.",
            is_read_only: true,
            cli_usage: "sendmock setup validate <file>",
            mcp_tool: "sendmock_setup_validate",
            cli_arguments: SETUP_FILE_ARGUMENT,
            cli_environment_inputs: PASSPHRASE_ENVIRONMENT_INPUT,
            success_flag_field: Some("is_valid"),
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SetupImportRequest,
    ) -> Result<SetupValidation, OperationError> {
        let setup_source = resolve_setup_source(operation_context, &input).await?;
        validate_setup(
            operation_context,
            &setup_source.setup_text,
            setup_source.setup_format,
            input.mode,
            input.passphrase.as_deref(),
        )
        .await
    }
}

pub struct ImportSetupOperation;

impl Operation for ImportSetupOperation {
    type Input = SetupImportRequest;
    type Output = SetupValidation;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSetupImport",
            method: HttpMethod::Post,
            path: "/api/v1/setup/import",
            summary: "Apply a setup from its text or a URL, merging or replacing; 422 with the errors and nothing applied when it is invalid.",
            is_destructive: true,
            cli_usage: "sendmock setup import <file> --yes",
            mcp_tool: "sendmock_setup_import",
            cli_arguments: SETUP_FILE_ARGUMENT,
            cli_environment_inputs: PASSPHRASE_ENVIRONMENT_INPUT,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Answers what it changed, as the validation listed it before applying. A replace that
    /// removes items needs `confirm_removed_count` to match how many.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SetupImportRequest,
    ) -> Result<SetupValidation, OperationError> {
        let setup_source = resolve_setup_source(operation_context, &input).await?;
        let setup_validation = validate_setup(
            operation_context,
            &setup_source.setup_text,
            setup_source.setup_format,
            input.mode,
            None,
        )
        .await?;
        let is_unconfirmed_replace = input.mode == SetupImportMode::Replace
            && setup_validation.is_valid
            && (setup_validation.removed_count > 0 || input.confirm_removed_count.is_some())
            && input.confirm_removed_count != Some(setup_validation.removed_count);
        if is_unconfirmed_replace {
            return Err(OperationError::Unprocessable {
                code: "setup_replace_unconfirmed",
                message: format!(
                    "This replace removes {removed_count} items; send confirm_removed_count = {removed_count} to go ahead",
                    removed_count = setup_validation.removed_count
                ),
            });
        }
        apply_setup_text(
            operation_context,
            &setup_source.setup_text,
            setup_source.setup_format,
            SetupImportOptions {
                source_path: setup_source.source_label,
                passphrase: input.passphrase,
                import_mode: input.mode,
            },
        )
        .await?;
        Ok(setup_validation)
    }
}
