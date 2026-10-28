use std::io::{IsTerminal, Write};

use clap::ArgMatches;
use sendmock_ops::OperationDefinition;
use serde_json::Value;

use crate::api_client::{ApiAnswer, ApiClient};
use crate::command_input::build_command_input;
use crate::output_printer::format_output;
use crate::server_url::resolve_server_url;
use crate::{CliError, MatchedOperation};

/// Runs the operation a command names on the server and prints or saves its answer.
pub async fn run_operation_command(matched_operation: &MatchedOperation) -> Result<(), CliError> {
    let command_matches = &matched_operation.command_matches;
    let definition = matched_operation.operation.definition();
    if definition.is_destructive
        && !command_matches
            .try_get_one::<bool>("yes")
            .ok()
            .flatten()
            .copied()
            .unwrap_or(false)
    {
        return Err(CliError::ConfirmationRequired {
            command: definition.cli_usage.to_owned(),
        });
    }
    let input = build_command_input(matched_operation.operation.as_ref(), command_matches)?;
    let server_url = resolve_server_url(
        command_matches
            .get_one::<String>("server")
            .map(String::as_str),
        std::env::var("SENDMOCK_HTTP_ADDR").ok().as_deref(),
    );
    let api_client = ApiClient::new(
        server_url,
        command_matches.get_one::<String>("token").cloned(),
    );
    match api_client.call_operation(definition, &input).await? {
        ApiAnswer::Json(answer) => {
            let as_json = command_matches.get_flag("json") || !std::io::stdout().is_terminal();
            println!("{}", format_output(&answer, as_json));
            check_success_flag(definition, &answer)
        }
        ApiAnswer::File(file_bytes) => write_file_answer(command_matches, &file_bytes),
        ApiAnswer::Empty => Ok(()),
    }
}

fn write_file_answer(command_matches: &ArgMatches, file_bytes: &[u8]) -> Result<(), CliError> {
    match command_matches
        .try_get_one::<String>("output")
        .ok()
        .flatten()
    {
        Some(output_path) => std::fs::write(output_path, file_bytes).map_err(|write_error| {
            CliError::UnwritableFile {
                file_path: output_path.clone(),
                reason: write_error.to_string(),
            }
        }),
        None => std::io::stdout()
            .write_all(file_bytes)
            .map_err(|write_error| CliError::UnwritableFile {
                file_path: "stdout".to_owned(),
                reason: write_error.to_string(),
            }),
    }
}

fn check_success_flag(definition: &OperationDefinition, answer: &Value) -> Result<(), CliError> {
    match definition.success_flag_field {
        Some(field_name) if answer[field_name] == Value::Bool(false) => {
            Err(CliError::CheckFailed {
                field_name: field_name.to_owned(),
            })
        }
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use clap::Command;

    use super::*;
    use crate::test_operations::build_test_registry;
    use crate::{CliExitCode, build_operation_commands, find_matched_operation};

    // AC: AI-01.4
    #[tokio::test]
    async fn a_destructive_command_refuses_to_run_without_yes() {
        let operation_registry = build_test_registry();
        let root_matches = Command::new("sendmock")
            .subcommands(build_operation_commands(&operation_registry))
            .try_get_matches_from([
                "sendmock",
                "test",
                "delete",
                "01J0ITEM",
                "--server",
                "http://127.0.0.1:9",
            ])
            .expect("the command line parses");
        let matched_operation =
            find_matched_operation(&operation_registry, &root_matches).expect("an operation");

        let run_result = run_operation_command(&matched_operation).await;

        let cli_error = run_result.expect_err("it refuses without --yes");
        assert!(matches!(cli_error, CliError::ConfirmationRequired { .. }));
        assert_eq!(cli_error.exit_code(), CliExitCode::Usage);
    }
}
