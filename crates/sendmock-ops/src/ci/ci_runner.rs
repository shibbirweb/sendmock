//! Runs a CI file against this instance: applies its setup, then runs each scenario with
//! `app_url` available to its steps (WH-15.2).

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Instant;

use serde_json::{Map, Value};

use super::ci_file::{CiFile, CiScenario, CiSetup};
use super::ci_reports::{build_junit_report, build_summary_markdown};
use super::ci_wire::CiReport;
use crate::scenarios::{
    ParsedScenario, ScenarioReport, build_step_operations, parse_scenario_file,
    parse_scenario_value, run_parsed_scenario,
};
use crate::setup::{SetupUrlSource, download_setup};
use crate::{
    ErasedOperation, ImportSetupOperation, Operation, OperationContext, OperationError,
    OperationRegistry, SetupImportMode, SetupImportRequest,
};

fn is_url(location: &str) -> bool {
    location.starts_with("https://") || location.starts_with("http://")
}

fn path_refused(what: &str, location: &str) -> OperationError {
    OperationError::InvalidInput {
        message: format!(
            "The {what} {location} is a path; give a URL or the text, or run the file with `sendmock ci run`, which reads paths."
        ),
        field: Some("ci_file".to_owned()),
    }
}

async fn apply_ci_setup(
    operation_context: &OperationContext,
    ci_setup: &CiSetup,
) -> Result<(), OperationError> {
    let import_request = match ci_setup {
        CiSetup::Location(location) if is_url(location) => SetupImportRequest {
            url: Some(location.clone()),
            ..SetupImportRequest::default()
        },
        CiSetup::Location(location) => return Err(path_refused("setup", location)),
        CiSetup::Inline { text, format } => SetupImportRequest {
            setup_text: Some(text.clone()),
            format: *format,
            ..SetupImportRequest::default()
        },
    };
    ImportSetupOperation
        .execute(
            operation_context,
            SetupImportRequest {
                mode: SetupImportMode::Merge,
                ..import_request
            },
        )
        .await?;
    Ok(())
}

/// The scenario's steps, downloaded when it names a URL.
async fn read_ci_scenario(
    operation_context: &OperationContext,
    ci_scenario: &CiScenario,
    step_operations: &BTreeMap<String, Arc<dyn ErasedOperation>>,
) -> Result<ParsedScenario, OperationError> {
    let is_known_step = |step_name: &str| step_operations.contains_key(step_name);
    let parsed_scenario = match ci_scenario {
        CiScenario::Steps { name, steps } => parse_scenario_value(
            &serde_json::json!({ "name": name, "steps": steps }),
            &is_known_step,
        ),
        CiScenario::Text { name, text } => {
            let mut parsed = parse_scenario_file(text, &is_known_step);
            parsed.name = parsed.name.or_else(|| name.clone());
            parsed
        }
        CiScenario::File { file } => return Err(path_refused("scenario", file)),
        CiScenario::Url { url } => {
            let downloaded = download_setup(
                operation_context,
                &SetupUrlSource {
                    url: url.clone(),
                    sha256: None,
                    headers: Vec::new(),
                },
            )
            .await?;
            parse_scenario_file(&downloaded.setup_text, &is_known_step)
        }
    };
    match parsed_scenario.problems.first() {
        Some(first_problem) => Err(OperationError::InvalidInput {
            message: format!(
                "{}: {}",
                parsed_scenario.name.as_deref().unwrap_or("a scenario"),
                first_problem.message
            ),
            field: Some("ci_file".to_owned()),
        }),
        None => Ok(parsed_scenario),
    }
}

/// Every scenario's steps, checked before any runs, so a bad file changes nothing.
pub async fn read_ci_scenarios(
    operation_context: &OperationContext,
    operation_registry: &OperationRegistry,
    ci_file: &CiFile,
) -> Result<Vec<ParsedScenario>, OperationError> {
    let step_operations = build_step_operations(operation_registry);
    let mut parsed_scenarios = Vec::new();
    for ci_scenario in &ci_file.scenarios {
        parsed_scenarios
            .push(read_ci_scenario(operation_context, ci_scenario, &step_operations).await?);
    }
    Ok(parsed_scenarios)
}

fn build_ci_report(
    scenario_reports: Vec<ScenarioReport>,
    started_at: String,
    duration_ms: u64,
) -> CiReport {
    let passed_count = scenario_reports
        .iter()
        .filter(|report| report.is_passed)
        .count();
    CiReport {
        is_passed: passed_count == scenario_reports.len(),
        started_at,
        duration_ms,
        passed_count,
        failed_count: scenario_reports.len() - passed_count,
        junit_xml: build_junit_report(&scenario_reports, duration_ms),
        summary_markdown: build_summary_markdown(&scenario_reports),
        scenarios: scenario_reports,
    }
}

/// Applies the setup, then runs every scenario; each runs all its steps up to its first
/// failure, and a failed scenario does not stop the next.
pub async fn run_ci_file(
    operation_context: &OperationContext,
    operation_registry: &OperationRegistry,
    ci_file: &CiFile,
) -> Result<CiReport, OperationError> {
    let started_at = Instant::now();
    let started_at_text = sendmock_core::format_rfc3339(operation_context.clock.now_unix_ms());
    let parsed_scenarios =
        read_ci_scenarios(operation_context, operation_registry, ci_file).await?;
    if let Some(ci_setup) = &ci_file.setup {
        apply_ci_setup(operation_context, ci_setup).await?;
    }
    let step_operations = build_step_operations(operation_registry);
    let mut starting_values = Map::new();
    if let Some(app_url) = &ci_file.app_url {
        starting_values.insert(
            "app_url".to_owned(),
            Value::from(app_url.trim_end_matches('/')),
        );
    }
    let mut scenario_reports = Vec::new();
    for parsed_scenario in parsed_scenarios {
        scenario_reports.push(
            run_parsed_scenario(
                operation_context,
                &step_operations,
                parsed_scenario,
                starting_values.clone(),
            )
            .await,
        );
    }
    let duration_ms = u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX);
    Ok(build_ci_report(
        scenario_reports,
        started_at_text,
        duration_ms,
    ))
}
