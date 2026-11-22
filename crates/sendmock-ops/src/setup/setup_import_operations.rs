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
            cli_usage: "sendmock setup import <file>",
            mcp_tool: "sendmock_setup_import",
            cli_arguments: SETUP_FILE_ARGUMENT,
            cli_environment_inputs: PASSPHRASE_ENVIRONMENT_INPUT,
            server_confirmation_input: Some("confirm_removed_count"),
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
                message: describe_unconfirmed_removal(&setup_validation),
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

/// Names each item a replace would remove, so the person confirming knows what goes.
fn describe_unconfirmed_removal(setup_validation: &SetupValidation) -> String {
    let removed_items: Vec<String> = setup_validation
        .changes
        .iter()
        .flat_map(|section_change| {
            section_change
                .removed
                .iter()
                .map(move |item_name| format!("{} {item_name}", section_change.item_kind))
        })
        .collect();
    format!(
        "This replace removes {removed_count} items: {}. Send confirm_removed_count = {removed_count} (--confirm-removed-count {removed_count}) to go ahead",
        removed_items.join(", "),
        removed_count = setup_validation.removed_count
    )
}

#[cfg(test)]
mod tests {
    use super::super::setup_wire::SetupSectionChange;
    use super::*;
    use crate::setup::SetupFileFormat;

    // AC: PL-26.2
    #[test]
    fn a_replace_that_removes_items_names_each_one() {
        let setup_validation = SetupValidation {
            is_valid: true,
            format: SetupFileFormat::Toml,
            format_version: 2,
            upgraded_from_format_version: None,
            has_encrypted_secrets: false,
            errors: Vec::new(),
            summary: Vec::new(),
            changes: vec![SetupSectionChange {
                section: "webhook.endpoints".to_owned(),
                item_kind: "Webhook endpoint".to_owned(),
                added: Vec::new(),
                changed: Vec::new(),
                removed: vec!["Shop".to_owned(), "CRM".to_owned()],
            }],
            removed_count: 2,
        };

        let message = describe_unconfirmed_removal(&setup_validation);

        assert!(
            message.starts_with(
                "This replace removes 2 items: Webhook endpoint Shop, Webhook endpoint CRM."
            ),
            "{message}"
        );
        assert!(message.contains("--confirm-removed-count 2"));
    }

    // AC: PL-26.2
    #[test]
    fn the_cli_needs_no_yes_for_an_import_since_the_server_confirms_removals() {
        let definition = ImportSetupOperation.definition();

        assert!(definition.is_destructive);
        assert_eq!(
            definition.server_confirmation_input,
            Some("confirm_removed_count")
        );
        assert!(!definition.cli_usage.contains("--yes"));
    }
}
