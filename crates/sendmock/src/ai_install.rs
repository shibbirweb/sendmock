//! `sendmock ai install --target <agent>`: registers SendMock's MCP server and installs the
//! skill where the agent reads them, showing each change and asking first (AI-05.2). It runs
//! in the binary, with no server needed, since the skill and the setups ship with it.

mod config_merging;
mod install_plan;
mod line_diff;

use std::io::{BufRead, IsTerminal, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::{Arg, ArgAction, Command};
use sendmock_cli::{CliExitCode, MatchedOperation};
use sendmock_ops::ai::{AiAgentTarget, list_agent_setups, render_skill_markdown};
use serde_json::{Value, json};

use install_plan::{InstallPlaces, PlannedFile, plan_install};
use line_diff::render_line_diff;

/// The operation whose command `ai install` is.
pub const AI_AGENTS_OPERATION_ID: &str = "getAiAgents";

/// `--yes` writes without asking, for scripts and agents.
pub fn add_install_flags(root_command: Command) -> Command {
    root_command.mut_subcommand("ai", |ai_command| {
        ai_command.mut_subcommand("install", |install_command| {
            install_command.arg(
                Arg::new("yes")
                    .long("yes")
                    .action(ArgAction::SetTrue)
                    .help("Write the files without asking"),
            )
        })
    })
}

fn read_home_directory() -> PathBuf {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map_or_else(|| PathBuf::from("."), PathBuf::from)
}

/// Asks on a terminal; elsewhere nothing is written without `--yes`.
fn confirm_writing(file_count: usize) -> bool {
    if !std::io::stdin().is_terminal() {
        return false;
    }
    print!("Write {file_count} files? [y/N] ");
    let _ = std::io::stdout().flush();
    let mut answer = String::new();
    let _ = std::io::stdin().lock().read_line(&mut answer);
    matches!(answer.trim().to_ascii_lowercase().as_str(), "y" | "yes")
}

fn write_planned_files(changed_files: &[PlannedFile]) -> Result<(), std::io::Error> {
    for planned_file in changed_files {
        if let Some(parent_directory) = planned_file.path.parent() {
            std::fs::create_dir_all(parent_directory)?;
        }
        std::fs::write(&planned_file.path, &planned_file.new_text)?;
    }
    Ok(())
}

fn show_path(file_path: &Path, project_directory: &Path) -> String {
    file_path
        .strip_prefix(project_directory)
        .unwrap_or(file_path)
        .display()
        .to_string()
}

/// Prints each change and writes them once confirmed.
fn install_for(target: AiAgentTarget, is_confirmed: bool, as_json: bool) -> ExitCode {
    let project_directory = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let home_directory = read_home_directory();
    let install_places = InstallPlaces {
        project_directory: &project_directory,
        home_directory: &home_directory,
    };
    let skill_markdown = render_skill_markdown(env!("CARGO_PKG_VERSION"));
    let changed_files: Vec<PlannedFile> = plan_install(target, &install_places, &skill_markdown)
        .into_iter()
        .filter(|planned_file| {
            std::fs::read_to_string(&planned_file.path).ok().as_deref()
                != Some(&planned_file.new_text)
        })
        .collect();
    for planned_file in &changed_files {
        let old_text = std::fs::read_to_string(&planned_file.path).unwrap_or_default();
        let file_label = show_path(&planned_file.path, &project_directory);
        if let Some(diff_text) = render_line_diff(&file_label, &old_text, &planned_file.new_text) {
            eprintln!("{diff_text}\n");
        }
    }
    let written_paths: Vec<String> = changed_files
        .iter()
        .map(|planned_file| show_path(&planned_file.path, &project_directory))
        .collect();
    if !changed_files.is_empty() && !(is_confirmed || confirm_writing(changed_files.len())) {
        eprintln!("Nothing written. Run it again with --yes to write these files.");
        return CliExitCode::Error.into();
    }
    if let Err(write_error) = write_planned_files(&changed_files) {
        eprintln!("Could not write the files: {write_error}");
        return CliExitCode::Error.into();
    }
    if as_json {
        println!("{}", json!({ "target": target, "written": written_paths }));
    } else if written_paths.is_empty() {
        println!("SendMock is already set up for this agent.");
    } else {
        println!("Wrote {}.", written_paths.join(", "));
    }
    CliExitCode::Success.into()
}

/// Without `--target`, every agent's setup, as `GET /ai/agents` answers it.
pub fn run_ai_install(matched_operation: &MatchedOperation) -> ExitCode {
    let command_matches = &matched_operation.command_matches;
    let as_json = command_matches
        .try_get_one::<bool>("json")
        .ok()
        .flatten()
        .copied()
        .unwrap_or(false);
    let is_confirmed = command_matches
        .try_get_one::<bool>("yes")
        .ok()
        .flatten()
        .copied()
        .unwrap_or(false);
    let Some(target_text) = command_matches
        .try_get_one::<String>("target")
        .ok()
        .flatten()
    else {
        println!(
            "{}",
            serde_json::to_string_pretty(&list_agent_setups()).unwrap_or_default()
        );
        return CliExitCode::Success.into();
    };
    match serde_json::from_value::<AiAgentTarget>(Value::from(target_text.as_str())) {
        Ok(target) => install_for(target, is_confirmed, as_json),
        Err(_) => {
            eprintln!(
                "Unknown agent {target_text}: use claude-code, codex, cursor, gemini or vscode."
            );
            CliExitCode::Usage.into()
        }
    }
}
