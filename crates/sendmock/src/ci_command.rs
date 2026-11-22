//! `sendmock ci run` and `sendmock ci init` (WH-15): the run starts its own SendMock unless
//! `--server` names one and writes the reports CI systems read; init writes the files.

mod ci_file_reader;
mod ci_report_writer;
mod ci_system_detection;

use std::process::ExitCode;

use clap::{Arg, ArgAction, Command};
use sendmock_cli::{
    ApiAnswer, ApiClient, CliError, CliExitCode, MatchedOperation, resolve_server_url,
};
use serde_json::{Value, json};

use crate::embedded_server::EmbeddedServer;
use ci_file_reader::{inline_ci_paths, read_ci_source};
use ci_report_writer::{write_ci_reports, write_text_file};
use ci_system_detection::detect_ci_system;

pub const CI_RUN_OPERATION_ID: &str = "postCiRun";
pub const CI_INIT_OPERATION_ID: &str = "postCiInit";

/// `--junit` on `ci run` and `--yes` on `ci init`, which the server's operation has no use for.
pub fn add_ci_flags(root_command: Command) -> Command {
    root_command.mut_subcommand("ci", |ci_command| {
        ci_command
            .mut_subcommand("run", |run_command| {
                run_command.arg(
                    Arg::new("junit").long("junit").value_name("FILE").help(
                        "Write the JUnit XML report here [default: the CI file's report.junit]",
                    ),
                )
            })
            .mut_subcommand("init", |init_command| {
                init_command.arg(
                    Arg::new("yes")
                        .long("yes")
                        .action(ArgAction::SetTrue)
                        .help("Overwrite files that exist"),
                )
            })
    })
}

pub(crate) fn read_flag<'matches>(
    matched_operation: &'matches MatchedOperation,
    flag_name: &str,
) -> Option<&'matches String> {
    matched_operation
        .command_matches
        .try_get_one::<String>(flag_name)
        .ok()
        .flatten()
}

fn build_client(matched_operation: &MatchedOperation, server_url: String) -> ApiClient {
    ApiClient::new(server_url, read_flag(matched_operation, "token").cloned())
}

async fn run_ci_file(matched_operation: &MatchedOperation) -> Result<bool, CliError> {
    let location = read_flag(matched_operation, "ci_file")
        .cloned()
        .unwrap_or_default();
    let (ci_text, base_directory) = read_ci_source(&location).await?;
    let inlined_text = inline_ci_paths(&ci_text, &base_directory)?;
    let inlined_ci: Value = serde_json::from_str(&inlined_text).unwrap_or_default();
    let named_server = read_flag(matched_operation, "server").cloned();
    let (_embedded_server, server_url) = match named_server {
        Some(server_url) => (None, resolve_server_url(Some(&server_url), None)),
        None => {
            let (embedded_server, server_url) = EmbeddedServer::start_for_ci()
                .await
                .map_err(|start_error| CliError::InvalidInput(start_error.to_string()))?;
            (Some(embedded_server), server_url)
        }
    };
    let answer = build_client(matched_operation, server_url)
        .call_operation(
            matched_operation.operation.definition(),
            &json!({ "ci_file": inlined_text }),
        )
        .await?;
    let ApiAnswer::Json(ci_report) = answer else {
        return Err(CliError::UnreadableAnswer(
            "The run answered no report".to_owned(),
        ));
    };
    write_ci_reports(matched_operation, &inlined_ci, &ci_report)?;
    Ok(ci_report["is_passed"] == Value::Bool(true))
}

async fn init_ci_files(matched_operation: &MatchedOperation) -> Result<(), CliError> {
    let current_directory = std::env::current_dir().unwrap_or_default();
    let provider = match read_flag(matched_operation, "provider") {
        Some(provider) => Value::from(provider.as_str()),
        None => detect_ci_system(&current_directory)
            .map(|ci_system| serde_json::to_value(ci_system).unwrap_or_default())
            .ok_or_else(|| CliError::InvalidInput(
                "No CI configuration found here; say which with --provider github_actions, gitlab_ci, circleci, bitbucket_pipelines, azure_pipelines or jenkins".to_owned(),
            ))?,
    };
    let server_url = resolve_server_url(
        read_flag(matched_operation, "server").map(String::as_str),
        std::env::var("SENDMOCK_HTTP_ADDR").ok().as_deref(),
    );
    let input = json!({
        "provider": provider,
        "setup_url": read_flag(matched_operation, "setup_url"),
        "app_url": read_flag(matched_operation, "app_url"),
    });
    let answer = build_client(matched_operation, server_url)
        .call_operation(matched_operation.operation.definition(), &input)
        .await?;
    let ApiAnswer::Json(init_files) = answer else {
        return Err(CliError::UnreadableAnswer(
            "Init answered no files".to_owned(),
        ));
    };
    let can_overwrite = matched_operation.command_matches.get_flag("yes");
    for init_file in init_files["files"].as_array().into_iter().flatten() {
        let file_path = init_file["path"].as_str().unwrap_or_default();
        if current_directory.join(file_path).exists() && !can_overwrite {
            println!("kept     {file_path} (it exists; --yes overwrites it)");
            continue;
        }
        write_text_file(file_path, init_file["content"].as_str().unwrap_or_default())?;
        println!(
            "wrote    {file_path}: {}",
            init_file["purpose"].as_str().unwrap_or_default()
        );
    }
    Ok(())
}

fn build_runtime() -> Result<tokio::runtime::Runtime, ExitCode> {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(|runtime_error| {
            eprintln!("Could not start the runtime: {runtime_error}");
            CliExitCode::Error.into()
        })
}

/// `sendmock ci run`: exits `0` when every scenario passes, `5` when one fails, `2` when a
/// file is invalid.
pub fn run_ci_run_command(matched_operation: &MatchedOperation) -> ExitCode {
    let runtime = match build_runtime() {
        Ok(runtime) => runtime,
        Err(exit_code) => return exit_code,
    };
    match runtime.block_on(run_ci_file(matched_operation)) {
        Ok(true) => CliExitCode::Success.into(),
        Ok(false) => CliExitCode::AssertionFailed.into(),
        Err(cli_error) => {
            eprintln!("{cli_error}");
            cli_error.exit_code().into()
        }
    }
}

pub fn run_ci_init_command(matched_operation: &MatchedOperation) -> ExitCode {
    let runtime = match build_runtime() {
        Ok(runtime) => runtime,
        Err(exit_code) => return exit_code,
    };
    match runtime.block_on(init_ci_files(matched_operation)) {
        Ok(()) => CliExitCode::Success.into(),
        Err(cli_error) => {
            eprintln!("{cli_error}");
            cli_error.exit_code().into()
        }
    }
}
