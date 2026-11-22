//! The interactive launcher (PL-22): a bare `sendmock` at a terminal asks which services to
//! start, remembers the answer in `last-run.toml`, and `--last` and `--services` start
//! without asking.

mod last_run_command;
mod last_run_file;
mod launch_choice;
mod launch_decision;
mod launch_service;
mod launcher_flow;
mod port_check;
mod terminal_prompter;

use std::collections::BTreeMap;
use std::io::IsTerminal;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::process::ExitCode;

pub use last_run_command::{LastRunAction, run_last_run_command};
use last_run_file::{
    LastRunRead, delete_last_run, locate_last_run_file, read_last_run, write_last_run,
};
use launch_choice::LaunchChoice;
use launch_decision::{LaunchConditions, should_ask};
use launch_service::LaunchService;
use launcher_flow::{LauncherOutcome, LauncherStart, run_launcher};
use port_check::is_address_free;
use terminal_prompter::TerminalPrompter;

use crate::cli_arguments::ServeArguments;
use crate::config::{ConfigError, ServerConfig};

/// The exit code for an unknown service name, as for any usage mistake.
const USAGE_ERROR_EXIT_CODE: u8 = 2;

/// What the start does after the launcher.
pub enum LaunchPlan {
    Start(Box<ServeArguments>),
    Stop(ExitCode),
}

/// Moves `last-run.toml` elsewhere, such as a test's own folder.
const LAST_RUN_FILE_VARIABLE: &str = "SENDMOCK_LAST_RUN_FILE";

fn last_run_path() -> Option<PathBuf> {
    std::env::var_os(LAST_RUN_FILE_VARIABLE)
        .filter(|file_path| !file_path.is_empty())
        .map(PathBuf::from)
        .or_else(|| locate_last_run_file(dirs::config_dir().as_deref()))
}

/// The saved choice, or `None` with the reason said on stderr.
fn read_saved_choice() -> Option<LaunchChoice> {
    let file_path = last_run_path()?;
    match read_last_run(&file_path) {
        LastRunRead::Saved(launch_choice) => Some(launch_choice),
        LastRunRead::Missing => None,
        LastRunRead::Unusable(reason) => {
            eprintln!(
                "Ignoring {}: {reason}. Starting with the defaults.",
                file_path.display()
            );
            None
        }
    }
}

/// Each service's address from flags, variables and `sendmock.toml`, for services that have one.
fn read_configured_addresses(
    serve_arguments: &ServeArguments,
) -> Result<BTreeMap<LaunchService, SocketAddr>, ConfigError> {
    let server_config = ServerConfig::load(serve_arguments)?;
    let configured = [
        (LaunchService::Smtp, Some(server_config.smtp_addr)),
        (LaunchService::Smtps, server_config.smtp.smtps_addr),
        (
            LaunchService::Provider,
            server_config.provider_ports.provider_addr,
        ),
        (
            LaunchService::ProviderTls,
            server_config.provider_ports.tls.map(|tls| tls.tls_addr),
        ),
        (LaunchService::Catcher, server_config.catcher_addr),
        (
            LaunchService::Pop3,
            server_config.pop3.map(|pop3| pop3.pop3_addr),
        ),
    ];
    Ok(configured
        .into_iter()
        .filter_map(|(service, address)| address.map(|address| (service, address)))
        .collect())
}

/// Fills the saved choice into the arguments, for `--last` and `sendmock mcp --embedded --last`.
pub fn apply_last_run(serve_arguments: &mut ServeArguments) {
    match read_saved_choice() {
        Some(saved_choice) => saved_choice.apply_to(serve_arguments),
        None => eprintln!("Nothing saved by the launcher yet; starting with the defaults."),
    }
}

/// `--services smtp,catcher,pop3`: those services on their saved, configured or default
/// addresses, without asking.
fn choose_named_services(
    service_names: &str,
    serve_arguments: &ServeArguments,
) -> Result<LaunchChoice, String> {
    let saved_addresses = read_saved_choice()
        .map(|saved| saved.addresses)
        .unwrap_or_default();
    let configured_addresses = read_configured_addresses(serve_arguments).unwrap_or_default();
    let mut named_services = Vec::new();
    for service_name in service_names
        .split(',')
        .filter(|name| !name.trim().is_empty())
    {
        let service = LaunchService::parse(service_name).ok_or_else(|| {
            let known_names: Vec<&str> = LaunchService::ALL
                .iter()
                .map(|known| known.name())
                .collect();
            format!(
                "{} is not a service. Use {}.",
                service_name.trim(),
                known_names.join(", ")
            )
        })?;
        let address = saved_addresses
            .get(&service)
            .or_else(|| configured_addresses.get(&service))
            .copied()
            .unwrap_or_else(|| service.default_address());
        named_services.push((service, address));
    }
    Ok(LaunchChoice::from_services(named_services))
}

fn read_launch_conditions(serve_arguments: &ServeArguments) -> LaunchConditions {
    LaunchConditions {
        is_bare_command: std::env::args_os().count() == 1,
        is_stdin_terminal: std::io::stdin().is_terminal(),
        is_stdout_terminal: std::io::stdout().is_terminal(),
        is_ci: std::env::var_os("CI").is_some_and(|ci_value| !ci_value.is_empty()),
        is_no_input: serve_arguments.no_input,
    }
}

/// Asks, saves the answer and prints the equivalent command; Cancel starts nothing.
fn ask_and_choose(serve_arguments: &ServeArguments) -> Option<Option<LaunchChoice>> {
    let configured_addresses = read_configured_addresses(serve_arguments).ok()?;
    let server_config = ServerConfig::load(serve_arguments).ok()?;
    let first_run_choice = LaunchChoice::from_services(configured_addresses.clone());
    let launcher_start = LauncherStart {
        starting_choice: read_saved_choice().unwrap_or(first_run_choice),
        default_choice: LaunchChoice::defaults(),
        offered_addresses: configured_addresses,
    };
    let mut prompter = TerminalPrompter {
        http_address: server_config.http_addr,
    };
    let outcome = run_launcher(&mut prompter, &launcher_start, &is_address_free).ok()?;
    let LauncherOutcome::Run {
        launch_choice,
        was_reset,
    } = outcome
    else {
        return Some(None);
    };
    if let Some(file_path) = last_run_path() {
        if was_reset {
            let _ = delete_last_run(&file_path);
        }
        if let Err(write_error) = write_last_run(&file_path, &launch_choice) {
            eprintln!("Could not save {}: {write_error}", file_path.display());
        }
    }
    println!("Starting the same as: {}", launch_choice.describe_command());
    Some(Some(launch_choice))
}

/// Decides how this start gets its listeners: `--services`, `--last`, the questions, or the
/// arguments as given.
pub fn prepare_launch(serve_arguments: &ServeArguments) -> LaunchPlan {
    let mut launched_arguments = serve_arguments.clone();
    if let Some(service_names) = &serve_arguments.services {
        match choose_named_services(service_names, serve_arguments) {
            Ok(launch_choice) => launch_choice.apply_to(&mut launched_arguments),
            Err(problem) => {
                eprintln!("{problem}");
                return LaunchPlan::Stop(ExitCode::from(USAGE_ERROR_EXIT_CODE));
            }
        }
    } else if serve_arguments.last {
        apply_last_run(&mut launched_arguments);
    } else if should_ask(read_launch_conditions(serve_arguments)) {
        // A configuration error is reported by the normal start, so it skips the questions.
        match ask_and_choose(serve_arguments) {
            Some(Some(launch_choice)) => launch_choice.apply_to(&mut launched_arguments),
            Some(None) => return LaunchPlan::Stop(ExitCode::SUCCESS),
            None => {}
        }
    }
    LaunchPlan::Start(Box::new(launched_arguments))
}
