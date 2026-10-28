use std::process::ExitCode;

use sendmock_store::{Database, EMBEDDED_MIGRATIONS};

use crate::cli_arguments::ServeArguments;
use crate::config::ServerConfig;
use crate::logging;
use crate::seed_file_check::check_seed_file;
use crate::server_runner::run_server;
use crate::startup_error::StartupError;

pub fn start_server(serve_arguments: &ServeArguments) -> ExitCode {
    match serve(serve_arguments) {
        Ok(()) => ExitCode::SUCCESS,
        Err(startup_error) => {
            eprintln!("{startup_error}");
            startup_error.exit_code()
        }
    }
}

fn serve(serve_arguments: &ServeArguments) -> Result<(), StartupError> {
    let server_config = ServerConfig::load(serve_arguments)?;
    logging::initialise_logging(server_config.log_format, server_config.log_level);
    if let Some(seed_file_path) = &server_config.seed_file_path {
        let seed_validation = check_seed_file(seed_file_path)?;
        let item_count: usize = seed_validation
            .summary
            .iter()
            .map(|item_count| item_count.item_count)
            .sum();
        tracing::info!(seed_file = %seed_file_path.display(), item_count, "Seed file is valid");
    }
    let database = Database::open(server_config.database_location.clone(), EMBEDDED_MIGRATIONS)?;
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(StartupError::Runtime)?;
    runtime.block_on(run_server(&server_config, database))
}
