use super::environment_references::resolve_environment_references;
use crate::setup::{
    SetupFileFormat, SetupSecretOpener, prepare_setup_document, read_setup_document,
};
use crate::{OperationContext, OperationError};

/// A seed file ready to apply: upgraded to this build's format, `${ENV_VAR}` references
/// resolved and encrypted secrets opened.
pub struct PreparedSeed {
    pub seed_document: toml::Table,
    /// Referenced variables that are not set, named when an item is refused.
    pub missing_variables: Vec<String>,
}

/// Environment references are resolved before the secrets are opened, so a `${` inside a
/// secret is kept as written. Nothing is applied here, so a refusal changes nothing.
pub fn prepare_seed_for_apply(
    operation_context: &OperationContext,
    seed_toml: &str,
    passphrase: Option<&str>,
) -> Result<PreparedSeed, OperationError> {
    let setup_document =
        read_setup_document(seed_toml, SetupFileFormat::Toml).map_err(|read_problem| {
            OperationError::Unprocessable {
                code: "invalid_seed",
                message: read_problem.describe(),
            }
        })?;
    let prepared_setup = prepare_setup_document(operation_context, setup_document)?;
    let mut seed_value = toml::Value::Table(prepared_setup.setup_document);
    let mut missing_variables = Vec::new();
    resolve_environment_references(
        &mut seed_value,
        operation_context.environment_reader.as_ref(),
        &mut missing_variables,
    );
    if !missing_variables.is_empty() {
        tracing::warn!(
            ?missing_variables,
            "seed file references unset environment variables"
        );
    }
    SetupSecretOpener::new(passphrase).open_secrets(&mut seed_value)?;
    let toml::Value::Table(seed_document) = seed_value else {
        return Ok(PreparedSeed {
            seed_document: toml::Table::new(),
            missing_variables,
        });
    };
    Ok(PreparedSeed {
        seed_document,
        missing_variables,
    })
}
