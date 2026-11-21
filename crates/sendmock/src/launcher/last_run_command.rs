use std::process::ExitCode;

use clap::Subcommand;
use serde_json::json;

use super::last_run_file::{LastRunRead, delete_last_run, read_last_run};
use super::last_run_path;

#[derive(Debug, Clone, Subcommand)]
pub enum LastRunAction {
    /// Delete the saved choice, so the next `sendmock` asks with today's defaults
    Clear,
}

fn clear_last_run(file_path: &std::path::Path) -> ExitCode {
    match delete_last_run(file_path) {
        Ok(true) => {
            println!("Deleted {}", file_path.display());
            ExitCode::SUCCESS
        }
        Ok(false) => {
            println!("Nothing was saved.");
            ExitCode::SUCCESS
        }
        Err(delete_error) => {
            eprintln!("Could not delete {}: {delete_error}", file_path.display());
            ExitCode::from(1)
        }
    }
}

/// `sendmock last-run` prints the saved choice; `sendmock last-run clear` deletes it.
pub fn run_last_run_command(action: Option<&LastRunAction>, is_json: bool) -> ExitCode {
    let Some(file_path) = last_run_path() else {
        eprintln!("This system has no config folder, so nothing is saved.");
        return ExitCode::from(1);
    };
    if let Some(LastRunAction::Clear) = action {
        return clear_last_run(&file_path);
    }
    let saved_choice = match read_last_run(&file_path) {
        LastRunRead::Saved(launch_choice) => Some(launch_choice),
        LastRunRead::Missing => None,
        LastRunRead::Unusable(reason) => {
            eprintln!("{} is not usable: {reason}", file_path.display());
            return ExitCode::from(1);
        }
    };
    if is_json {
        let services: serde_json::Map<String, serde_json::Value> = saved_choice
            .iter()
            .flat_map(|launch_choice| &launch_choice.addresses)
            .map(|(service, address)| (service.name().to_owned(), json!(address.to_string())))
            .collect();
        let saved_json = json!({
            "path": file_path.display().to_string(),
            "is_saved": saved_choice.is_some(),
            "services": services,
            "command": saved_choice.as_ref().map(|launch_choice| launch_choice.describe_command()),
        });
        println!("{saved_json}");
        return ExitCode::SUCCESS;
    }
    match saved_choice {
        Some(launch_choice) => {
            for (service, address) in &launch_choice.addresses {
                println!("{:<22} {address}", service.label());
            }
            println!("Same as: {}", launch_choice.describe_command());
        }
        None => println!("Nothing saved yet; `sendmock` asks on its next start at a terminal."),
    }
    ExitCode::SUCCESS
}
