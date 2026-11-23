//! `sendmock trust`: adds SendMock's local CA to the system store and the runtimes that ignore
//! it, so apps reach the HTTPS provider port with no other change (PL-25). It runs in the
//! binary, with no server needed; `--check` reports and `--undo` removes what it added.

mod command_runner;
#[cfg(test)]
mod fake_command_runner;
mod java_target;
mod local_ca_source;
mod node_target;
mod php_ini_block;
mod php_scanned_ini;
mod php_target;
mod python_target;
mod system_store_target;
mod trust_output;
mod trust_target;
#[cfg(test)]
mod trust_target_tests;

use std::io::{BufRead, IsTerminal, Write};
use std::process::ExitCode;
use std::sync::Arc;

use clap::{Arg, ArgAction, Command};
use sendmock_cli::{CliExitCode, MatchedOperation, resolve_server_url};
use sendmock_ops::{TlsTrustPlace, TlsTrustReport, TrustInspector};

pub use command_runner::{CommandRunner, SystemCommandRunner};
pub use trust_target::{LocalCa, TrustCheck, TrustState, TrustTarget};

use local_ca_source::{choose_local_ca, read_existing_folder_ca};
use trust_output::{print_checks, print_manual_steps, print_plan, write_bundles_only};

/// The operation whose command `sendmock trust` is.
pub const TLS_TRUST_OPERATION_ID: &str = "getTlsTrust";

/// `--check` reports, `--undo` removes what was added, `--yes` changes without asking.
pub fn add_trust_flags(root_command: Command) -> Command {
    root_command.mut_subcommand("trust", |trust_command| {
        trust_command
            .arg(flag(
                "check",
                "Report what trusts the local CA and change nothing",
            ))
            .arg(flag("undo", "Remove what sendmock trust added"))
            .arg(flag(
                "bundle-only",
                "Only write the combined CA bundles PHP and Python can point at, and print their paths",
            ))
            .arg(flag("yes", "Change the trust stores without asking"))
    })
}

fn flag(name: &'static str, help: &'static str) -> Arg {
    Arg::new(name)
        .long(name)
        .action(ArgAction::SetTrue)
        .help(help)
}

/// The server's view of `sendmock trust --check`, for `GET /api/v1/tls/trust`, on the CA in
/// the server's own folder (beside its database, or the data folder).
pub struct LocalTrustInspector {
    pub ca_folder: std::path::PathBuf,
}

impl TrustInspector for LocalTrustInspector {
    fn inspect_trust(&self) -> Result<TlsTrustReport, String> {
        let local_ca = read_existing_folder_ca(&self.ca_folder)?;
        let places = inspect_trust(&local_ca)
            .into_iter()
            .map(|check| TlsTrustPlace {
                place: check.place,
                state: check.state.as_str().to_owned(),
                detail: check.detail,
            })
            .collect();
        Ok(TlsTrustReport {
            ca_path: local_ca.certificate_path.display().to_string(),
            places,
        })
    }
}

/// Every place on this machine that can trust the CA, the system store first.
pub fn list_trust_targets(runner: Arc<dyn CommandRunner>) -> Vec<Box<dyn TrustTarget>> {
    let mut trust_targets: Vec<Box<dyn TrustTarget>> = Vec::new();
    trust_targets.extend(system_store_target::find_system_store(Arc::clone(&runner)));
    for php_target in php_target::find_php_targets(&runner) {
        trust_targets.push(Box::new(php_target));
    }
    if let Some(java_target) = java_target::find_java_target(&runner) {
        trust_targets.push(Box::new(java_target));
    }
    if let Some(python_target) = python_target::find_python_target(&runner) {
        trust_targets.push(Box::new(python_target));
    }
    trust_targets.push(Box::new(node_target::NodeTarget));
    trust_targets
}

/// Each place's state, as `--check` and `GET /api/v1/tls/trust` report it.
pub fn inspect_trust(local_ca: &LocalCa) -> Vec<TrustCheck> {
    list_trust_targets(Arc::new(SystemCommandRunner))
        .iter()
        .map(|trust_target| trust_target.check(local_ca))
        .collect()
}

fn read_flag(matched_operation: &MatchedOperation, name: &str) -> bool {
    matched_operation
        .command_matches
        .try_get_one::<bool>(name)
        .ok()
        .flatten()
        .copied()
        .unwrap_or(false)
}

pub fn run_trust_command(matched_operation: &MatchedOperation) -> ExitCode {
    let server_url = resolve_server_url(
        matched_operation
            .command_matches
            .try_get_one::<String>("server")
            .ok()
            .flatten()
            .map(String::as_str),
        std::env::var("SENDMOCK_HTTP_ADDR").ok().as_deref(),
    );
    run_trust(
        TrustAction {
            is_check: read_flag(matched_operation, "check"),
            is_undo: read_flag(matched_operation, "undo"),
            is_confirmed: read_flag(matched_operation, "yes"),
            is_bundle_only: read_flag(matched_operation, "bundle-only"),
        },
        read_flag(matched_operation, "json"),
        &server_url,
    )
}

/// What `sendmock trust` was asked to do.
pub struct TrustAction {
    pub is_check: bool,
    pub is_undo: bool,
    pub is_confirmed: bool,
    /// Write the combined bundles and change nothing else (no system store, no ini files).
    pub is_bundle_only: bool,
}

/// Checks, adds or removes the local CA, as `sendmock trust` and `sendmock preset` run it.
pub fn run_trust(trust_action: TrustAction, as_json: bool, server_url: &str) -> ExitCode {
    let chosen_ca = match choose_local_ca(server_url) {
        Ok(chosen_ca) => chosen_ca,
        Err(reason) => {
            eprintln!("Could not read the local CA: {reason}");
            return CliExitCode::Error.into();
        }
    };
    let local_ca = chosen_ca.local_ca;
    if trust_action.is_bundle_only {
        return write_bundles_only(&local_ca, &chosen_ca.source);
    }
    let trust_targets = list_trust_targets(Arc::new(SystemCommandRunner));
    let checks: Vec<TrustCheck> = trust_targets
        .iter()
        .map(|target| target.check(&local_ca))
        .collect();
    if trust_action.is_check {
        print_checks(&local_ca, &chosen_ca.source, &checks, as_json);
        return CliExitCode::Success.into();
    }
    let is_undo = trust_action.is_undo;
    let wanted_state = if is_undo {
        TrustState::Trusted
    } else {
        TrustState::Missing
    };
    let planned: Vec<usize> = (0..checks.len())
        .filter(|&index| checks[index].state == wanted_state)
        .collect();
    print_plan(&local_ca, &chosen_ca.source, &checks, &planned, is_undo);
    if !is_undo {
        print_manual_steps(&trust_targets, &local_ca);
    }
    if planned.is_empty() {
        return CliExitCode::Success.into();
    }
    if !(trust_action.is_confirmed || confirm_changes(planned.len(), is_undo)) {
        eprintln!("Nothing changed. Run it again with --yes to change without asking.");
        return CliExitCode::Error.into();
    }
    apply_plan(&trust_targets, &local_ca, &checks, &planned, is_undo)
}

/// Asks on a terminal; elsewhere nothing changes without `--yes`.
fn confirm_changes(place_count: usize, is_undo: bool) -> bool {
    if !std::io::stdin().is_terminal() {
        return false;
    }
    let verb = if is_undo {
        "Remove the CA from"
    } else {
        "Add the CA to"
    };
    print!("{verb} {place_count} places? [y/N] ");
    let _ = std::io::stdout().flush();
    let mut answer = String::new();
    let _ = std::io::stdin().lock().read_line(&mut answer);
    matches!(answer.trim().to_ascii_lowercase().as_str(), "y" | "yes")
}

fn apply_plan(
    trust_targets: &[Box<dyn TrustTarget>],
    local_ca: &LocalCa,
    checks: &[TrustCheck],
    planned: &[usize],
    is_undo: bool,
) -> ExitCode {
    let mut has_failure = false;
    for &index in planned {
        let result = if is_undo {
            trust_targets[index].remove(local_ca)
        } else {
            trust_targets[index].add(local_ca)
        };
        match result {
            Ok(change) => println!("{}: {change}", checks[index].place),
            Err(reason) => {
                has_failure = true;
                eprintln!("{}: {reason}", checks[index].place);
            }
        }
    }
    for check in checks
        .iter()
        .filter(|check| check.state == TrustState::Manual && !is_undo)
    {
        println!("{}: {}", check.place, check.detail);
    }
    if has_failure {
        CliExitCode::Error.into()
    } else {
        CliExitCode::Success.into()
    }
}
