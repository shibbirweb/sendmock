use super::setup_document_reader::read_setup_document;
use super::setup_document_writer::write_setup_document;
use super::setup_file_format::SetupFileFormat;
use super::setup_preparation::prepare_setup_document;
use super::setup_secret_writer::{EncryptedSecretWriter, SecretReferenceWriter};
use super::setup_section_filter::SetupSectionFilter;
use super::setup_wire::{SetupExportRequest, SetupMigrateRequest};
use crate::seed::{check_setup_text, write_selected_setup_text};
use crate::{
    AnswerKind, CliArgument, FileAnswer, HttpMethod, Operation, OperationContext,
    OperationDefinition, OperationError,
};

/// The answer's content type in OpenAPI; each answer names its own format's type.
const SETUP_CONTENT_TYPE: &str = "text/plain";
const PASSPHRASE_ENVIRONMENT_INPUT: &[(&str, &str)] =
    &[("passphrase", "SENDMOCK_SETUP_PASSPHRASE")];

fn write_setup_file(setup_text: String, setup_format: SetupFileFormat) -> FileAnswer {
    FileAnswer {
        content_type: setup_format.content_type().to_owned(),
        file_name: Some(format!("sendmock.setup.{}", setup_format.file_extension())),
        bytes: setup_text.into_bytes(),
    }
}

pub struct ExportSetupOperation;

impl Operation for ExportSetupOperation {
    type Input = SetupExportRequest;
    type Output = FileAnswer;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSetupExport",
            method: HttpMethod::Post,
            path: "/api/v1/setup/export",
            summary: "The configuration as a versioned setup file in TOML, JSON or YAML.",
            is_read_only: true,
            cli_usage: "sendmock setup export",
            mcp_tool: "sendmock_setup_export",
            cli_environment_inputs: PASSPHRASE_ENVIRONMENT_INPUT,
            answer_kind: AnswerKind::File {
                content_type: SETUP_CONTENT_TYPE,
            },
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Secrets are `${ENV_VAR}` references unless `include_secrets` encrypts them with the
    /// passphrase; a passphrase without `include_secrets` is ignored, as the CLI fills it from
    /// the environment.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SetupExportRequest,
    ) -> Result<FileAnswer, OperationError> {
        let setup_format = input.format.unwrap_or_default();
        let section_filter = SetupSectionFilter::read(&input.only, &input.except)?;
        let setup_text = if input.include_secrets {
            let passphrase = input
                .passphrase
                .as_deref()
                .filter(|passphrase| !passphrase.is_empty())
                .ok_or_else(|| OperationError::InvalidInput {
                    message: "include_secrets needs a passphrase to encrypt them with".to_owned(),
                    field: Some("passphrase".to_owned()),
                })?;
            let secret_writer =
                EncryptedSecretWriter::new(passphrase, operation_context.random_source.clone())?;
            write_selected_setup_text(
                operation_context,
                setup_format,
                &secret_writer,
                &section_filter,
            )
            .await?
        } else {
            write_selected_setup_text(
                operation_context,
                setup_format,
                &SecretReferenceWriter,
                &section_filter,
            )
            .await?
        };
        Ok(write_setup_file(setup_text, setup_format))
    }
}

pub struct MigrateSetupOperation;

impl Operation for MigrateSetupOperation {
    type Input = SetupMigrateRequest;
    type Output = FileAnswer;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSetupMigrate",
            method: HttpMethod::Post,
            path: "/api/v1/setup/migrate",
            summary: "A setup file upgraded to this build's format version, without applying it.",
            is_read_only: true,
            cli_usage: "sendmock setup migrate <file>",
            mcp_tool: "sendmock_setup_migrate",
            cli_arguments: &[CliArgument {
                placeholder: "file",
                input_name: "setup_text",
                reads_file: true,
                is_optional: false,
            }],
            answer_kind: AnswerKind::File {
                content_type: SETUP_CONTENT_TYPE,
            },
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Upgrades in memory, one format step at a time, and writes the copy in the same format
    /// or `to_format`; encrypted secrets stay encrypted. The file given is never changed.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SetupMigrateRequest,
    ) -> Result<FileAnswer, OperationError> {
        let source_format = input
            .format
            .unwrap_or_else(|| SetupFileFormat::detect(&input.setup_text));
        let target_format = input.to_format.unwrap_or(source_format);
        let setup_document = read_setup_document(&input.setup_text, source_format)
            .map_err(|read_problem| invalid_setup(&read_problem.describe()))?;
        let prepared_setup = prepare_setup_document(operation_context, setup_document)?;
        let setup_check = check_setup_text(&input.setup_text, source_format);
        if !setup_check.is_valid() {
            return Err(invalid_setup(&setup_check.describe_problems()));
        }
        let migrated_text = write_setup_document(&prepared_setup.setup_document, target_format)?;
        Ok(write_setup_file(migrated_text, target_format))
    }
}

fn invalid_setup(problems: &str) -> OperationError {
    OperationError::Unprocessable {
        code: "invalid_seed",
        message: format!("The setup file is not valid: {problems}"),
    }
}
