use std::process::ExitCode;

use sendmock_cli::{CliExitCode, MatchedOperation, run_operation_command};

pub fn run_client_command(matched_operation: &MatchedOperation) -> ExitCode {
    let runtime = match tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(runtime_error) => {
            eprintln!("Could not start the client runtime: {runtime_error}");
            return CliExitCode::Error.into();
        }
    };
    match runtime.block_on(run_operation_command(matched_operation)) {
        Ok(()) => CliExitCode::Success.into(),
        Err(cli_error) => {
            eprintln!("{cli_error}");
            cli_error.exit_code().into()
        }
    }
}
