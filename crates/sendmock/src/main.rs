//! The `sendmock` binary: reads the configuration and runs the server.

mod cli_arguments;
mod config;
mod listener_binding;
mod logging;
mod server_runner;
mod shutdown_signal;
mod startup_error;

use std::process::ExitCode;

use clap::Parser;

use cli_arguments::CliArguments;
use config::ServerConfig;
use startup_error::StartupError;

fn main() -> ExitCode {
    let cli_arguments = CliArguments::parse();
    match serve(&cli_arguments) {
        Ok(()) => ExitCode::SUCCESS,
        Err(startup_error) => {
            eprintln!("{startup_error}");
            startup_error.exit_code()
        }
    }
}

fn serve(cli_arguments: &CliArguments) -> Result<(), StartupError> {
    let server_config = ServerConfig::load(cli_arguments.serve_arguments())?;
    logging::initialise_logging(server_config.log_format, server_config.log_level);
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(StartupError::Runtime)?;
    runtime.block_on(server_runner::run_server(&server_config))
}
