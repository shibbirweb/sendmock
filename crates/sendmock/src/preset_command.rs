//! `sendmock preset <name> --app-url <url>`: runs `sendmock trust` on this machine (unless
//! `--no-trust`), then applies the preset on the server, with each webhook path a flag of its
//! own and `--import-numbers` read from a CSV file (PL-27).

use std::process::ExitCode;

use clap::{Arg, ArgAction, Command};
use sendmock_cli::{ApiAnswer, ApiClient, CliExitCode, MatchedOperation, resolve_server_url};
use serde_json::{Map, Value, json};

use crate::trust_command::{TrustAction, run_trust};

/// The operation whose command `sendmock preset <name>` is.
pub const PRESET_APPLY_OPERATION_ID: &str = "postPresetsByPresetNameApply";

/// The preset options that get a flag of their own (`--mailgun-events-path`).
const PATH_OPTIONS: [&str; 5] = [
    "mailgun_events_path",
    "mailgun_inbound_path",
    "twilio_inbound_path",
    "twilio_status_path",
    "twilio_debugger_path",
];

pub fn add_preset_flags(root_command: Command) -> Command {
    root_command.mut_subcommand("preset", |preset_command| {
        let preset_command = preset_command
            .arg(
                Arg::new("import_numbers")
                    .long("import-numbers")
                    .value_name("CSV_FILE")
                    .help("Numbers to add, one per line: number,label,subaccount_sid,messaging_service_sid"),
            )
            .arg(
                Arg::new("no_trust")
                    .long("no-trust")
                    .action(ArgAction::SetTrue)
                    .help("Do not run sendmock trust first"),
            );
        PATH_OPTIONS.iter().fold(preset_command, |command, option_name| {
            command.arg(
                Arg::new(*option_name)
                    .long(option_name.replace('_', "-"))
                    .value_name("PATH")
                    .help("The app's path for this webhook; see sendmock presets for the default"),
            )
        })
    })
}

fn read_text(matched_operation: &MatchedOperation, argument_id: &str) -> Option<String> {
    matched_operation
        .command_matches
        .try_get_one::<String>(argument_id)
        .ok()
        .flatten()
        .cloned()
}

fn read_switch(matched_operation: &MatchedOperation, argument_id: &str) -> bool {
    matched_operation
        .command_matches
        .try_get_one::<bool>(argument_id)
        .ok()
        .flatten()
        .copied()
        .unwrap_or(false)
}

/// The apply body from the flags; the CSV file is read here, on the machine running the CLI.
fn build_apply_input(matched_operation: &MatchedOperation) -> Result<Value, String> {
    let options: Map<String, Value> = PATH_OPTIONS
        .iter()
        .filter_map(|option_name| {
            read_text(matched_operation, option_name)
                .map(|path| ((*option_name).to_owned(), Value::from(path)))
        })
        .collect();
    let numbers_csv = match read_text(matched_operation, "import_numbers") {
        Some(csv_path) => Some(
            std::fs::read_to_string(&csv_path).map_err(|error| format!("{csv_path}: {error}"))?,
        ),
        None => None,
    };
    Ok(json!({
        "preset_name": read_text(matched_operation, "preset_name").unwrap_or_default(),
        "app_url": read_text(matched_operation, "app_url").unwrap_or_default(),
        "options": options,
        "numbers_csv": numbers_csv,
    }))
}

pub fn run_preset_command(matched_operation: &MatchedOperation) -> ExitCode {
    let as_json = read_switch(matched_operation, "json");
    let server_url = resolve_server_url(
        read_text(matched_operation, "server").as_deref(),
        std::env::var("SENDMOCK_HTTP_ADDR").ok().as_deref(),
    );
    if !read_switch(matched_operation, "no_trust") {
        let trust_action = TrustAction {
            is_check: false,
            is_undo: false,
            is_confirmed: false,
        };
        let _ = run_trust(trust_action, false, &server_url);
    }
    let input = match build_apply_input(matched_operation) {
        Ok(input) => input,
        Err(reason) => {
            eprintln!("{reason}");
            return CliExitCode::Usage.into();
        }
    };
    let Ok(runtime) = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
    else {
        eprintln!("Could not start the client runtime");
        return CliExitCode::Error.into();
    };
    let api_client = ApiClient::new(server_url, read_text(matched_operation, "token"));
    let definition = matched_operation.operation.definition();
    match runtime.block_on(api_client.call_operation(definition, &input)) {
        Ok(ApiAnswer::Json(answer)) => {
            print_apply_result(&answer, as_json);
            CliExitCode::Success.into()
        }
        Ok(_) => CliExitCode::Success.into(),
        Err(cli_error) => {
            eprintln!("{cli_error}");
            cli_error.exit_code().into()
        }
    }
}

fn print_apply_result(answer: &Value, as_json: bool) {
    if as_json {
        println!(
            "{}",
            serde_json::to_string_pretty(answer).unwrap_or_default()
        );
        return;
    }
    let print_lines = |field_name: &str, prefix: &str| {
        for line in answer[field_name]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
        {
            println!("{prefix}{line}");
        }
    };
    println!(
        "Applied the {} preset.",
        answer["preset_name"].as_str().unwrap_or_default()
    );
    print_lines("steps", "  ");
    print_lines("warnings", "Warning: ");
    println!(
        "\nAdd to your app's .env:\n\n{}",
        answer["env_block"].as_str().unwrap_or_default()
    );
}
