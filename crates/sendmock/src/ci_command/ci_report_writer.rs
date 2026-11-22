//! The reports a CI run leaves: the JUnit and JSON files, GitHub's step summary and the
//! lines on stdout.

use std::io::Write as _;
use std::path::Path;

use sendmock_cli::{CliError, MatchedOperation};
use serde_json::Value;

use super::read_flag;

/// Adds the summary to `GITHUB_STEP_SUMMARY` when GitHub Actions sets it.
fn append_step_summary(summary_markdown: &str) {
    let Some(summary_path) =
        std::env::var_os("GITHUB_STEP_SUMMARY").filter(|path| !path.is_empty())
    else {
        return;
    };
    if let Ok(mut summary_file) = std::fs::OpenOptions::new()
        .append(true)
        .create(true)
        .open(summary_path)
    {
        let _ = summary_file.write_all(summary_markdown.as_bytes());
    }
}

pub fn write_text_file(file_path: &str, text: &str) -> Result<(), CliError> {
    if let Some(parent_directory) = Path::new(file_path)
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        let _ = std::fs::create_dir_all(parent_directory);
    }
    std::fs::write(file_path, text).map_err(|write_error| CliError::UnwritableFile {
        file_path: file_path.to_owned(),
        reason: write_error.to_string(),
    })
}

/// The JUnit and JSON files, the GitHub step summary, and the answer on stdout.
pub fn write_ci_reports(
    matched_operation: &MatchedOperation,
    inlined_ci: &Value,
    ci_report: &Value,
) -> Result<(), CliError> {
    let junit_path = read_flag(matched_operation, "junit")
        .cloned()
        .or_else(|| inlined_ci["report"]["junit"].as_str().map(str::to_owned));
    if let Some(junit_path) = junit_path {
        write_text_file(
            &junit_path,
            ci_report["junit_xml"].as_str().unwrap_or_default(),
        )?;
    }
    if let Some(json_path) = inlined_ci["report"]["json"].as_str() {
        write_text_file(json_path, &ci_report.to_string())?;
    }
    append_step_summary(ci_report["summary_markdown"].as_str().unwrap_or_default());
    if matched_operation.command_matches.get_flag("json") {
        println!("{ci_report}");
        return Ok(());
    }
    for scenario in ci_report["scenarios"].as_array().into_iter().flatten() {
        let failed_step = scenario["steps"]
            .as_array()
            .into_iter()
            .flatten()
            .find(|step| step["status"] == "failed");
        match failed_step {
            None => println!("passed  {}", scenario["name"].as_str().unwrap_or_default()),
            Some(step) => println!(
                "failed  {}: step {} ({}): {}",
                scenario["name"].as_str().unwrap_or_default(),
                step["step"],
                step["run"].as_str().unwrap_or_default(),
                step["error"].as_str().unwrap_or_default()
            ),
        }
    }
    Ok(())
}
