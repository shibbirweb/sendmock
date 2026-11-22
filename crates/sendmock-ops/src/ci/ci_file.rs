//! A CI file (`format: sendmock.ci`): the setup, the app's URL and the scenarios one
//! `sendmock ci run` runs (WH-15.2), in JSON or YAML.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::setup::SetupFileFormat;

pub const CI_FORMAT_NAME: &str = "sendmock.ci";
pub const CI_FORMAT_VERSION: i64 = 1;

/// `sendmock: { format: sendmock.ci, format_version: 1 }`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CiFileHeader {
    /// Always `sendmock.ci`.
    pub format: String,
    /// The CI file's shape; this build reads version 1.
    pub format_version: i64,
}

/// The setup to apply first: a path or URL, or the file's text.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(untagged)]
pub enum CiSetup {
    /// An `https://` URL, or a path relative to the CI file (which `sendmock ci run` reads).
    Location(String),
    Inline {
        /// The setup file's text.
        text: String,
        /// `toml`, `json` or `yaml`, when the text does not say.
        #[serde(default)]
        format: Option<SetupFileFormat>,
    },
}

/// One scenario: its steps inline, its text, or a file or URL holding it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(untagged)]
pub enum CiScenario {
    Steps {
        name: String,
        /// Each with `run`, and optionally `with` and `save`.
        steps: Vec<Map<String, Value>>,
    },
    Text {
        #[serde(default)]
        name: Option<String>,
        /// A scenario file's text, in TOML, JSON or YAML.
        text: String,
    },
    /// A path relative to the CI file, which `sendmock ci run` reads.
    File { file: String },
    /// An `https://` URL to a scenario file.
    Url { url: String },
}

/// Where `sendmock ci run` writes its reports, unless flags say otherwise.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CiReportPaths {
    /// The JUnit XML report, which every CI system shows.
    #[serde(default)]
    pub junit: Option<String>,
    /// The JSON report.
    #[serde(default)]
    pub json: Option<String>,
}

/// The CI file, as JSON or YAML.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CiFile {
    pub sendmock: CiFileHeader,
    #[serde(default)]
    pub setup: Option<CiSetup>,
    /// The app's base URL; scenarios read it as `{{ app_url }}`.
    #[serde(default)]
    pub app_url: Option<String>,
    pub scenarios: Vec<CiScenario>,
    #[serde(default)]
    pub report: CiReportPaths,
}

/// The file, or every reason it cannot be read.
pub fn parse_ci_file(ci_text: &str) -> Result<CiFile, Vec<String>> {
    let ci_document: Value = serde_yaml_ng::from_str(ci_text)
        .map_err(|parse_error| vec![format!("Not valid JSON or YAML: {parse_error}")])?;
    let header_format = ci_document["sendmock"]["format"]
        .as_str()
        .unwrap_or_default();
    if header_format != CI_FORMAT_NAME {
        return Err(vec![format!(
            "Start the file with sendmock: {{ format: {CI_FORMAT_NAME}, format_version: {CI_FORMAT_VERSION} }}"
        )]);
    }
    let format_version = ci_document["sendmock"]["format_version"]
        .as_i64()
        .unwrap_or(0);
    if format_version > CI_FORMAT_VERSION {
        return Err(vec![format!(
            "This CI file is format {format_version}; this SendMock reads format {CI_FORMAT_VERSION}. Upgrade SendMock."
        )]);
    }
    let ci_file: CiFile =
        serde_json::from_value(ci_document).map_err(|read_error| vec![read_error.to_string()])?;
    if ci_file.scenarios.is_empty() {
        return Err(vec!["Add at least one scenario.".to_owned()]);
    }
    Ok(ci_file)
}

#[cfg(test)]
mod tests {
    use super::*;

    const CI_YAML: &str = "sendmock:\n  format: sendmock.ci\n  format_version: 1\nsetup: https://example.test/sendmock.setup.yml\napp_url: http://localhost:8000\nscenarios:\n  - name: paid order\n    steps:\n      - run: assert\n        with: { that: \"1 == 1\" }\n  - file: scenarios/refund.toml\n  - url: https://example.test/refund.yml\nreport:\n  junit: sendmock-report.xml\n";

    // AC: WH-15.2
    #[test]
    fn a_yaml_ci_file_reads_its_setup_app_url_scenarios_and_report() {
        let ci_file = parse_ci_file(CI_YAML).unwrap_or_else(|problems| panic!("{problems:?}"));

        assert_eq!(
            ci_file.setup,
            Some(CiSetup::Location(
                "https://example.test/sendmock.setup.yml".to_owned()
            ))
        );
        assert_eq!(ci_file.app_url.as_deref(), Some("http://localhost:8000"));
        assert_eq!(ci_file.scenarios.len(), 3);
        assert!(
            matches!(&ci_file.scenarios[1], CiScenario::File { file } if file == "scenarios/refund.toml")
        );
        assert_eq!(ci_file.report.junit.as_deref(), Some("sendmock-report.xml"));
    }

    // AC: WH-15.2
    #[test]
    fn a_file_without_the_header_a_newer_one_or_no_scenarios_is_refused() {
        let headerless = parse_ci_file("scenarios: []\n");
        let newer =
            parse_ci_file("sendmock: { format: sendmock.ci, format_version: 9 }\nscenarios: []\n");
        let empty =
            parse_ci_file("sendmock: { format: sendmock.ci, format_version: 1 }\nscenarios: []\n");

        assert!(headerless.is_err_and(|problems| problems[0].contains("format: sendmock.ci")));
        assert!(newer.is_err_and(|problems| problems[0].contains("Upgrade SendMock")));
        assert!(empty.is_err_and(|problems| problems[0].contains("at least one scenario")));
    }
}
