//! CLI commands that call operations on a running SendMock over HTTP.

mod api_client;
mod cli_error;
mod client_arguments;
mod command_description;
mod operation_command_runner;
mod operation_commands;
mod output_printer;
mod server_url;

pub use cli_error::{CliError, CliExitCode};
pub use client_arguments::ClientArguments;
pub use command_description::{CommandDescription, describe_operation_commands};
pub use operation_command_runner::run_operation_command;
pub use operation_commands::{MatchedOperation, build_operation_commands, find_matched_operation};
