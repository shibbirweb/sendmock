use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::scenarios::ScenarioReport;

/// Body of `POST /api/v1/ci/run` and `/ci/validate`: a CI file's text.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct CiFileRequest {
    /// The CI file (`format: sendmock.ci`) in JSON or YAML. A setup or scenario named by a
    /// path must be inlined first, as `sendmock ci run` does; URLs are downloaded.
    pub ci_file: String,
}

/// Answer of `POST /api/v1/ci/validate`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct CiValidation {
    pub is_valid: bool,
    pub scenario_count: usize,
    /// Each problem, with the scenario it is in when there is one.
    pub problems: Vec<String>,
}

/// Answer of `POST /api/v1/ci/run`: every scenario's steps, and the reports CI systems read.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct CiReport {
    pub is_passed: bool,
    pub started_at: String,
    pub duration_ms: u64,
    pub passed_count: usize,
    pub failed_count: usize,
    pub scenarios: Vec<ScenarioReport>,
    /// The JUnit XML report: a test suite per scenario and a test case per step.
    pub junit_xml: String,
    /// A Markdown summary, as `GITHUB_STEP_SUMMARY` shows it.
    pub summary_markdown: String,
}
