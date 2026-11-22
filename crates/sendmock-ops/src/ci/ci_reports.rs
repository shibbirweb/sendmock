//! The reports a CI run writes (WH-15.3): JUnit XML, which every CI system shows, and a
//! Markdown summary for GitHub's step summary.

use std::fmt::Write as _;

use crate::scenarios::{ScenarioReport, ScenarioStepStatus};

fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn to_seconds(duration_ms: u64) -> String {
    format!(
        "{:.3}",
        std::time::Duration::from_millis(duration_ms).as_secs_f64()
    )
}

fn count_failed_steps(scenario_report: &ScenarioReport) -> usize {
    scenario_report
        .steps
        .iter()
        .filter(|step_result| step_result.status == ScenarioStepStatus::Failed)
        .count()
}

/// A test suite per scenario and a test case per step, named by number and operation; a
/// failed step carries its reason, and steps after it are skipped.
pub fn build_junit_report(scenario_reports: &[ScenarioReport], duration_ms: u64) -> String {
    let step_count: usize = scenario_reports
        .iter()
        .map(|report| report.steps.len())
        .sum();
    let failure_count: usize = scenario_reports.iter().map(count_failed_steps).sum();
    let mut junit_xml = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<testsuites name=\"sendmock\" tests=\"{step_count}\" failures=\"{failure_count}\" time=\"{}\">\n",
        to_seconds(duration_ms)
    );
    for scenario_report in scenario_reports {
        let scenario_name = escape_xml(&scenario_report.name);
        let skipped_count = scenario_report
            .steps
            .iter()
            .filter(|step_result| step_result.status == ScenarioStepStatus::Skipped)
            .count();
        let _ = writeln!(
            junit_xml,
            "  <testsuite name=\"{scenario_name}\" tests=\"{}\" failures=\"{}\" skipped=\"{skipped_count}\" time=\"{}\" timestamp=\"{}\">",
            scenario_report.steps.len(),
            count_failed_steps(scenario_report),
            to_seconds(scenario_report.duration_ms),
            escape_xml(&scenario_report.started_at)
        );
        for step_result in &scenario_report.steps {
            let case_name = escape_xml(&format!("{}. {}", step_result.step, step_result.run));
            let case_start = format!(
                "    <testcase classname=\"{scenario_name}\" name=\"{case_name}\" time=\"{}\"",
                to_seconds(step_result.duration_ms)
            );
            let reason = escape_xml(step_result.error.as_deref().unwrap_or_default());
            let _ = match step_result.status {
                ScenarioStepStatus::Passed => writeln!(junit_xml, "{case_start}/>"),
                ScenarioStepStatus::Failed => writeln!(
                    junit_xml,
                    "{case_start}>\n      <failure message=\"{reason}\">{reason}</failure>\n    </testcase>"
                ),
                ScenarioStepStatus::Skipped => writeln!(
                    junit_xml,
                    "{case_start}>\n      <skipped message=\"{reason}\"/>\n    </testcase>"
                ),
            };
        }
        junit_xml.push_str("  </testsuite>\n");
    }
    junit_xml.push_str("</testsuites>\n");
    junit_xml
}

fn describe_status(status: ScenarioStepStatus) -> &'static str {
    match status {
        ScenarioStepStatus::Passed => "passed",
        ScenarioStepStatus::Failed => "failed",
        ScenarioStepStatus::Skipped => "skipped",
    }
}

/// A heading with the count, then a table of steps per scenario with the failing reason.
pub fn build_summary_markdown(scenario_reports: &[ScenarioReport]) -> String {
    let passed_count = scenario_reports
        .iter()
        .filter(|report| report.is_passed)
        .count();
    let mut summary = format!(
        "## SendMock: {passed_count} of {} scenarios passed\n",
        scenario_reports.len()
    );
    for scenario_report in scenario_reports {
        let scenario_outcome = if scenario_report.is_passed {
            "passed"
        } else {
            "failed"
        };
        let _ = write!(
            summary,
            "\n### {} ({scenario_outcome})\n\n| Step | Operation | Outcome | Reason |\n| --- | --- | --- | --- |\n",
            scenario_report.name
        );
        for step_result in &scenario_report.steps {
            let reason = step_result
                .error
                .as_deref()
                .unwrap_or_default()
                .replace('|', "\\|")
                .replace('\n', " ");
            let _ = writeln!(
                summary,
                "| {} | `{}` | {} | {reason} |",
                step_result.step,
                step_result.run,
                describe_status(step_result.status)
            );
        }
    }
    summary
}

#[cfg(test)]
mod tests {
    use serde_json::Value;

    use super::*;
    use crate::scenarios::ScenarioStepResult;

    fn step(
        step_number: usize,
        run: &str,
        status: ScenarioStepStatus,
        error: Option<&str>,
    ) -> ScenarioStepResult {
        ScenarioStepResult {
            step: step_number,
            run: run.to_owned(),
            status,
            input: Value::Null,
            output: Value::Null,
            error: error.map(str::to_owned),
            saved_as: None,
            duration_ms: 12,
        }
    }

    fn failed_scenario() -> ScenarioReport {
        ScenarioReport {
            name: "a paid order <is> accepted".to_owned(),
            is_passed: false,
            started_at: "2026-11-22T10:00:00Z".to_owned(),
            duration_ms: 1500,
            steps: vec![
                step(1, "payment.simulate", ScenarioStepStatus::Passed, None),
                step(
                    2,
                    "assert",
                    ScenarioStepStatus::Failed,
                    Some("Expected \"paid\" == 'pending'"),
                ),
                step(
                    3,
                    "http",
                    ScenarioStepStatus::Skipped,
                    Some("An earlier step failed."),
                ),
            ],
        }
    }

    // AC: WH-15.3
    #[test]
    fn the_junit_report_lists_each_scenario_and_step_with_the_failing_reason() {
        let junit_xml = build_junit_report(&[failed_scenario()], 1500);

        assert!(
            junit_xml.contains(
                "<testsuites name=\"sendmock\" tests=\"3\" failures=\"1\" time=\"1.500\">"
            )
        );
        assert!(junit_xml.contains("<testsuite name=\"a paid order &lt;is&gt; accepted\" tests=\"3\" failures=\"1\" skipped=\"1\""));
        assert!(junit_xml.contains("name=\"1. payment.simulate\" time=\"0.012\"/>"));
        assert!(
            junit_xml
                .contains("<failure message=\"Expected &quot;paid&quot; == &apos;pending&apos;\">")
        );
        assert!(junit_xml.contains("<skipped message=\"An earlier step failed.\"/>"));
    }

    // AC: WH-15.3
    #[test]
    fn the_summary_counts_scenarios_and_lists_every_step() {
        let summary = build_summary_markdown(&[failed_scenario()]);

        assert!(summary.starts_with("## SendMock: 0 of 1 scenarios passed\n"));
        assert!(summary.contains("### a paid order <is> accepted (failed)"));
        assert!(summary.contains("| 2 | `assert` | failed | Expected \"paid\" == 'pending' |"));
        assert!(summary.contains("| 3 | `http` | skipped | An earlier step failed. |"));
    }
}
