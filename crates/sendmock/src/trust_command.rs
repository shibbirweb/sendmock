//! `sendmock trust`: adds SendMock's local CA to the system store and the runtimes that ignore
//! it, so apps reach the HTTPS provider port with no other change (PL-25). It runs in the
//! binary, with no server needed; `--check` reports and `--undo` removes what it added.

mod command_runner;
#[cfg(test)]
mod fake_command_runner;
mod java_target;
mod node_target;
mod php_ini_block;
mod php_target;
mod python_target;
mod system_store_target;
mod trust_target;
#[cfg(test)]
mod trust_target_tests;

use std::io::{BufRead, IsTerminal, Write};
use std::process::ExitCode;
use std::sync::Arc;

use clap::{Arg, ArgAction, Command};
use sendmock_cli::{CliExitCode, MatchedOperation};
use sendmock_ops::{TlsTrustPlace, TlsTrustReport, TrustInspector};
use serde_json::json;

pub use command_runner::{CommandRunner, SystemCommandRunner};
pub use trust_target::{LocalCa, TrustCheck, TrustState, TrustTarget};

use crate::provider_tls::{default_ca_folder, load_local_ca_certificate};

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
            .arg(flag("yes", "Change the trust stores without asking"))
    })
}

fn flag(name: &'static str, help: &'static str) -> Arg {
    Arg::new(name)
        .long(name)
        .action(ArgAction::SetTrue)
        .help(help)
}

/// The CA every server on this machine uses, made when there is none.
pub fn load_local_ca() -> Result<LocalCa, String> {
    let ca_folder = default_ca_folder();
    let (certificate_path, certificate_pem) =
        load_local_ca_certificate(&ca_folder, &[]).map_err(|error| error.to_string())?;
    Ok(LocalCa {
        certificate_path,
        certificate_pem,
        bundle_folder: ca_folder.join("trust"),
    })
}

/// The CA when it already exists, for reports that must not make one.
fn read_existing_local_ca() -> Result<LocalCa, String> {
    let ca_folder = default_ca_folder();
    let certificate_path = ca_folder.join("provider-ca-certificate.pem");
    let certificate_pem = std::fs::read_to_string(&certificate_path)
        .map_err(|_| "No local CA yet: run sendmock trust".to_owned())?;
    Ok(LocalCa {
        certificate_path,
        certificate_pem,
        bundle_folder: ca_folder.join("trust"),
    })
}

/// The server's view of `sendmock trust --check`, for `GET /api/v1/tls/trust`.
pub struct LocalTrustInspector;

impl TrustInspector for LocalTrustInspector {
    fn inspect_trust(&self) -> Result<TlsTrustReport, String> {
        let local_ca = read_existing_local_ca()?;
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
    let local_ca = match load_local_ca() {
        Ok(local_ca) => local_ca,
        Err(reason) => {
            eprintln!("Could not read the local CA: {reason}");
            return CliExitCode::Error.into();
        }
    };
    let trust_targets = list_trust_targets(Arc::new(SystemCommandRunner));
    let checks: Vec<TrustCheck> = trust_targets
        .iter()
        .map(|target| target.check(&local_ca))
        .collect();
    if read_flag(matched_operation, "check") {
        print_checks(&local_ca, &checks, read_flag(matched_operation, "json"));
        return CliExitCode::Success.into();
    }
    let is_undo = read_flag(matched_operation, "undo");
    let wanted_state = if is_undo {
        TrustState::Trusted
    } else {
        TrustState::Missing
    };
    let planned: Vec<usize> = (0..checks.len())
        .filter(|&index| checks[index].state == wanted_state)
        .collect();
    print_plan(&local_ca, &checks, &planned, is_undo);
    if planned.is_empty() {
        return CliExitCode::Success.into();
    }
    if !(read_flag(matched_operation, "yes") || confirm_changes(planned.len(), is_undo)) {
        eprintln!("Nothing changed. Run it again with --yes to change without asking.");
        return CliExitCode::Error.into();
    }
    apply_plan(&trust_targets, &local_ca, &checks, &planned, is_undo)
}

fn print_checks(local_ca: &LocalCa, checks: &[TrustCheck], as_json: bool) {
    if as_json {
        let places: Vec<_> = checks
            .iter()
            .map(|check| json!({ "place": check.place, "state": check.state.as_str(), "detail": check.detail }))
            .collect();
        let report =
            json!({ "ca_path": local_ca.certificate_path.display().to_string(), "places": places });
        println!(
            "{}",
            serde_json::to_string_pretty(&report).unwrap_or_default()
        );
        return;
    }
    println!("The local CA: {}", local_ca.certificate_path.display());
    for check in checks {
        println!(
            "  {:<8} {}: {}",
            check.state.as_str(),
            check.place,
            check.detail
        );
    }
}

fn print_plan(local_ca: &LocalCa, checks: &[TrustCheck], planned: &[usize], is_undo: bool) {
    println!("The local CA: {}", local_ca.certificate_path.display());
    for (index, check) in checks.iter().enumerate() {
        let action = match (planned.contains(&index), is_undo) {
            (true, false) => "add to",
            (true, true) => "remove from",
            (false, _) => check.state.as_str(),
        };
        println!("  {action:<11} {}", check.place);
    }
    if planned.is_empty() {
        println!("Nothing to change.");
    }
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
