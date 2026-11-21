use super::setup_document_reader::read_setup_document;
use super::setup_file_format::SetupFileFormat;
use super::setup_header::SetupHeader;
use super::setup_preparation::prepare_setup_document;
use super::setup_preview::{count_removed_items, preview_setup_changes};
use super::setup_secret_cipher::ENCRYPTED_SECRET_PREFIX;
use super::setup_secret_opener::SetupSecretOpener;
use super::setup_version_policy::SetupVersionDecision;
use super::setup_wire::{SetupImportMode, SetupValidation, SetupValidationError};
use crate::seed::check_setup_text;
use crate::{OperationContext, OperationError};

/// Checks a setup without applying it: its problems by line or key path, its format version
/// and whether it is upgraded, a format this build cannot read, a passphrase that does not
/// open its secrets, and per section what an import in `import_mode` would change.
pub async fn validate_setup(
    operation_context: &OperationContext,
    setup_text: &str,
    setup_format: SetupFileFormat,
    import_mode: SetupImportMode,
    passphrase: Option<&str>,
) -> Result<SetupValidation, OperationError> {
    let parsed_document = read_setup_document(setup_text, setup_format).ok();
    let mut setup_validation = start_validation(setup_text, setup_format, parsed_document.as_ref());
    let prepared_setup = match parsed_document {
        Some(setup_document) => match prepare_setup_document(operation_context, setup_document) {
            Ok(prepared_setup) => prepared_setup,
            Err(refusal) => {
                setup_validation
                    .errors
                    .push(describe_error(refusal.to_string()));
                return Ok(setup_validation);
            }
        },
        None => {
            add_check_problems(&mut setup_validation, setup_text, setup_format);
            return Ok(setup_validation);
        }
    };
    if let SetupVersionDecision::Upgrade {
        from_format_version,
        ..
    } = prepared_setup.version_decision
    {
        setup_validation.upgraded_from_format_version = Some(from_format_version);
    }
    add_check_problems(&mut setup_validation, setup_text, setup_format);
    if let Some(passphrase) = passphrase.filter(|_| setup_validation.has_encrypted_secrets) {
        check_passphrase(
            &mut setup_validation,
            &prepared_setup.setup_document,
            passphrase,
        );
    }
    if setup_validation.errors.is_empty() {
        setup_validation.changes = preview_setup_changes(
            operation_context,
            &prepared_setup.setup_document,
            import_mode,
        )
        .await?;
        setup_validation.removed_count = count_removed_items(&setup_validation.changes);
    }
    setup_validation.is_valid = setup_validation.errors.is_empty();
    Ok(setup_validation)
}

/// The answer before any check: the format, the format version the header names, and
/// whether the file holds encrypted secrets.
fn start_validation(
    setup_text: &str,
    setup_format: SetupFileFormat,
    parsed_document: Option<&toml::Table>,
) -> SetupValidation {
    SetupValidation {
        is_valid: false,
        format: setup_format,
        format_version: parsed_document.map_or(0, |setup_document| {
            SetupHeader::read(setup_document).format_version
        }),
        upgraded_from_format_version: None,
        has_encrypted_secrets: setup_text.contains(ENCRYPTED_SECRET_PREFIX),
        errors: Vec::new(),
        summary: Vec::new(),
        changes: Vec::new(),
        removed_count: 0,
    }
}

fn check_passphrase(
    setup_validation: &mut SetupValidation,
    setup_document: &toml::Table,
    passphrase: &str,
) {
    let mut opened_document = toml::Value::Table(setup_document.clone());
    if let Err(secret_error) =
        SetupSecretOpener::new(Some(passphrase)).open_secrets(&mut opened_document)
    {
        setup_validation
            .errors
            .push(describe_error(secret_error.to_string()));
    }
}

fn add_check_problems(
    setup_validation: &mut SetupValidation,
    setup_text: &str,
    setup_format: SetupFileFormat,
) {
    let setup_check = check_setup_text(setup_text, setup_format);
    setup_validation
        .errors
        .extend(
            setup_check
                .problems
                .into_iter()
                .map(|setup_problem| SetupValidationError {
                    line: setup_problem.line,
                    location: setup_problem.location,
                    message: setup_problem.message,
                }),
        );
    setup_validation.summary = setup_check.summary;
}

fn describe_error(message: String) -> SetupValidationError {
    SetupValidationError {
        line: None,
        location: None,
        message,
    }
}
