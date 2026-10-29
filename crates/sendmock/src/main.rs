//! The `sendmock` binary: runs the server, or a client command against a running one.

mod cli_arguments;
mod client_command;
mod config;
mod help_output;
mod instance_details_builder;
mod listener_binding;
mod logging;
mod seed_file_check;
mod server_runner;
mod server_startup;
mod shutdown_signal;
mod smtp_startup;
mod startup_error;
mod version_output;

use std::process::ExitCode;

use clap::{CommandFactory, FromArgMatches};
use sendmock_cli::{build_operation_commands, find_matched_operation};
use sendmock_ops::build_operation_registry;

use cli_arguments::{BuiltInCommand, CliArguments};

fn main() -> ExitCode {
    let operation_registry = build_operation_registry();
    let root_command =
        CliArguments::command().subcommands(build_operation_commands(&operation_registry));
    let root_matches = root_command.clone().get_matches();
    if let Some(matched_operation) = find_matched_operation(&operation_registry, &root_matches) {
        return client_command::run_client_command(&matched_operation);
    }
    let cli_arguments = CliArguments::from_arg_matches(&root_matches)
        .unwrap_or_else(|parse_error| parse_error.exit());
    match cli_arguments.built_in_command() {
        BuiltInCommand::Serve(serve_arguments) => server_startup::start_server(serve_arguments),
        BuiltInCommand::Version { json } => version_output::print_version(*json),
        BuiltInCommand::Help { all, json } => {
            help_output::print_help(root_command, &operation_registry, *all, *json)
        }
    }
}
