use std::io::IsTerminal;

use clap::ArgMatches;
use sendmock_ops::OperationDefinition;
use serde_json::{Map, Value};

use crate::api_client::ApiClient;
use crate::output_printer::format_output;
use crate::server_url::resolve_server_url;
use crate::{CliError, MatchedOperation};

/// Runs the operation a command names on the server and prints its answer.
pub async fn run_operation_command(matched_operation: &MatchedOperation) -> Result<(), CliError> {
    let command_matches = &matched_operation.command_matches;
    let definition = matched_operation.operation.definition();
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
    let input = build_operation_input(definition, command_matches)?;
    let answer = api_client.call_operation(definition, &input).await?;
    let as_json = command_matches.get_flag("json") || !std::io::stdout().is_terminal();
    println!("{}", format_output(&answer, as_json));
    check_success_flag(definition, &answer)
}

/// The operation's input from the command's positional arguments; `<file>` arguments send
/// the file's text.
fn build_operation_input(
    definition: &OperationDefinition,
    command_matches: &ArgMatches,
) -> Result<Value, CliError> {
    let mut input = Map::new();
    for cli_argument in definition.cli_arguments {
        let argument_value = command_matches
            .get_one::<String>(cli_argument.placeholder)
            .cloned()
            .unwrap_or_default();
        let input_value = if cli_argument.reads_file {
            std::fs::read_to_string(&argument_value).map_err(|read_error| {
                CliError::UnreadableFile {
                    file_path: argument_value.clone(),
                    reason: read_error.to_string(),
                }
            })?
        } else {
            argument_value
        };
        input.insert(
            cli_argument.input_name.to_owned(),
            Value::String(input_value),
        );
    }
    Ok(Value::Object(input))
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
