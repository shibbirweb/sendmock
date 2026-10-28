use std::io::IsTerminal;

use serde_json::{Map, Value};

use crate::api_client::ApiClient;
use crate::output_printer::format_output;
use crate::server_url::resolve_server_url;
use crate::{CliError, MatchedOperation};

/// Runs the operation a command names on the server and prints its answer.
pub async fn run_operation_command(matched_operation: &MatchedOperation) -> Result<(), CliError> {
    let command_matches = &matched_operation.command_matches;
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
    let input = Value::Object(Map::new());
    let answer = api_client
        .call_operation(matched_operation.operation.definition(), &input)
        .await?;
    let as_json = command_matches.get_flag("json") || !std::io::stdout().is_terminal();
    println!("{}", format_output(&answer, as_json));
    Ok(())
}
