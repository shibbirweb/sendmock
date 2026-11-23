//! What `sendmock trust` prints: the report, the plan, the manual steps and the bundles.

use std::process::ExitCode;
use std::sync::Arc;

use sendmock_cli::CliExitCode;
use serde_json::json;

use super::command_runner::SystemCommandRunner;
use super::list_trust_targets;
use super::trust_target::{LocalCa, TrustCheck, TrustTarget};

pub fn print_checks(local_ca: &LocalCa, ca_source: &str, checks: &[TrustCheck], as_json: bool) {
    if as_json {
        let places: Vec<_> = checks
            .iter()
            .map(|check| json!({ "place": check.place, "state": check.state.as_str(), "detail": check.detail }))
            .collect();
        let report = json!({
            "ca_path": local_ca.certificate_path.display().to_string(),
            "ca_source": ca_source,
            "places": places,
        });
        println!(
            "{}",
            serde_json::to_string_pretty(&report).unwrap_or_default()
        );
        return;
    }
    println!(
        "The local CA ({ca_source}): {}",
        local_ca.certificate_path.display()
    );
    for check in checks {
        println!(
            "  {:<8} {}: {}",
            check.state.as_str(),
            check.place,
            check.detail
        );
    }
}

pub fn print_plan(
    local_ca: &LocalCa,
    ca_source: &str,
    checks: &[TrustCheck],
    planned: &[usize],
    is_undo: bool,
) {
    println!(
        "The local CA ({ca_source}): {}",
        local_ca.certificate_path.display()
    );
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

/// `--bundle-only`: each runtime's combined bundle, written in SendMock's trust folder.
pub fn write_bundles_only(local_ca: &LocalCa, ca_source: &str) -> ExitCode {
    println!(
        "The local CA ({ca_source}): {}",
        local_ca.certificate_path.display()
    );
    let mut has_failure = false;
    for trust_target in list_trust_targets(Arc::new(SystemCommandRunner)) {
        match trust_target.write_bundle_only(local_ca) {
            Some(Ok(written)) => println!("  {written}"),
            Some(Err(reason)) => {
                has_failure = true;
                eprintln!("  could not write a bundle: {reason}");
            }
            None => {}
        }
    }
    if has_failure {
        CliExitCode::Error.into()
    } else {
        CliExitCode::Success.into()
    }
}

/// Prepares and prints what to set by hand where SendMock changes nothing, such as the combined
/// bundle for a PHP whose CA files come from Herd's own ini file.
pub fn print_manual_steps(trust_targets: &[Box<dyn TrustTarget>], local_ca: &LocalCa) {
    for trust_target in trust_targets {
        match trust_target.prepare_manual_step(local_ca) {
            Some(Ok(manual_step)) => println!("  set by hand: {manual_step}"),
            Some(Err(reason)) => eprintln!("  could not prepare a manual step: {reason}"),
            None => {}
        }
    }
}
