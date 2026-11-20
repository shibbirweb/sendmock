use std::collections::BTreeMap;

use super::seed_sections::{
    SEED_SECTIONS, SeedSection, find_seed_section, format_section_header, is_section_group,
};
use super::seed_string_rules::check_seed_string;
use super::{SeedItemCount, SeedValidation, SeedValidationError};
use crate::setup::{
    HEADER_KEY, SetupFileFormat, SetupHeader, SetupProblem, SetupVersionPolicy, TomlKeyLines,
    check_setup_header, join_location, read_setup_document,
};

/// The release this build is, for the message about a file it cannot read.
const THIS_VERSION: &str = env!("CARGO_PKG_VERSION");

/// What checking a setup file found: its problems, in line order, and how many items of each
/// kind it would create or update.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SetupCheck {
    pub problems: Vec<SetupProblem>,
    pub summary: Vec<SeedItemCount>,
}

impl SetupCheck {
    pub fn is_valid(&self) -> bool {
        self.problems.is_empty()
    }

    /// Every problem in one line, by line or key path.
    pub fn describe_problems(&self) -> String {
        self.problems
            .iter()
            .map(SetupProblem::describe)
            .collect::<Vec<_>>()
            .join("; ")
    }

    /// The answer of the seed endpoints, which take TOML, where every problem has a line.
    pub fn into_seed_validation(self) -> SeedValidation {
        SeedValidation {
            is_valid: self.problems.is_empty(),
            errors: self
                .problems
                .into_iter()
                .map(|setup_problem| SeedValidationError {
                    line: setup_problem.line.unwrap_or(1),
                    message: setup_problem.message,
                })
                .collect(),
            summary: self.summary,
        }
    }
}

/// Checks a TOML seed file without applying anything.
pub fn validate_seed_toml(seed_toml: &str) -> SeedValidation {
    check_setup_text(seed_toml, SetupFileFormat::Toml).into_seed_validation()
}

/// Checks a setup file in any format without applying anything: its syntax, the `[sendmock]`
/// header and its format version, known sections, the shape of each section, and
/// `${ENV_VAR}` references and secrets in every string. TOML problems name their line; JSON
/// and YAML problems past the syntax name their key path.
pub fn check_setup_text(setup_text: &str, setup_format: SetupFileFormat) -> SetupCheck {
    let key_lines = match setup_format {
        SetupFileFormat::Toml => match TomlKeyLines::read(setup_text) {
            Ok(key_lines) => Some(key_lines),
            Err(syntax_problems) => return SetupCheckReport::refuse(syntax_problems),
        },
        SetupFileFormat::Json | SetupFileFormat::Yaml => None,
    };
    let setup_document = match read_setup_document(setup_text, setup_format) {
        Ok(setup_document) => setup_document,
        Err(read_problem) => return SetupCheckReport::refuse(vec![read_problem]),
    };
    let mut report = SetupCheckReport {
        key_lines,
        problems: Vec::new(),
        item_counts: BTreeMap::new(),
    };
    report.check_document(&setup_document);
    report.finish()
}

/// Collects problems with where they are, and counts the items per kind.
struct SetupCheckReport {
    key_lines: Option<TomlKeyLines>,
    problems: Vec<SetupProblem>,
    item_counts: BTreeMap<&'static str, usize>,
}

impl SetupCheckReport {
    fn refuse(problems: Vec<SetupProblem>) -> SetupCheck {
        SetupCheck {
            problems,
            summary: Vec::new(),
        }
    }

    fn add_problem(&mut self, location: &str, message: String) {
        let line = self
            .key_lines
            .as_ref()
            .and_then(|key_lines| key_lines.line_of(location));
        self.problems.push(SetupProblem {
            line,
            location: Some(location.to_owned()),
            message,
        });
    }

    fn check_document(&mut self, setup_document: &toml::Table) {
        for (section_key, section_value) in setup_document {
            if section_key == HEADER_KEY {
                self.check_header(setup_document, section_value);
                continue;
            }
            self.check_top_level_entry(section_key, section_value);
        }
    }

    /// The header's keys, and whether this build reads the format version it names.
    fn check_header(&mut self, setup_document: &toml::Table, header_value: &toml::Value) {
        let Some(header_table) = header_value.as_table() else {
            self.add_problem(HEADER_KEY, format!("Write the header as [{HEADER_KEY}]"));
            return;
        };
        let mut header_problems: Vec<String> = header_table
            .iter()
            .filter_map(|(header_key, header_value)| check_setup_header(header_key, header_value))
            .collect();
        let version_policy = SetupVersionPolicy::default();
        let version_decision = version_policy.decide(&SetupHeader::read(setup_document));
        header_problems.extend(version_policy.describe_refusal(
            &version_decision,
            THIS_VERSION,
            None,
        ));
        for header_problem in header_problems {
            self.add_problem(HEADER_KEY, header_problem);
        }
    }

    fn check_top_level_entry(&mut self, key_name: &str, section_value: &toml::Value) {
        if let Some(seed_section) = find_seed_section(key_name) {
            self.check_section(seed_section, key_name, section_value);
            return;
        }
        match (is_section_group(key_name), section_value) {
            (true, toml::Value::Table(group_table)) => {
                for (sub_key, sub_value) in group_table {
                    let section_path = join_location(key_name, sub_key);
                    match find_seed_section(&section_path) {
                        Some(seed_section) => {
                            self.check_section(seed_section, &section_path, sub_value)
                        }
                        None => self.report_unknown_section(&section_path, sub_value),
                    }
                }
            }
            _ => self.report_unknown_section(key_name, section_value),
        }
    }

    fn report_unknown_section(&mut self, section_path: &str, section_value: &toml::Value) {
        let is_item_list = section_value.is_array();
        let section_header = format_section_header(section_path, is_item_list);
        self.add_problem(section_path, format!("Unknown section {section_header}"));
    }

    fn check_section(
        &mut self,
        seed_section: &'static SeedSection,
        section_location: &str,
        section_value: &toml::Value,
    ) {
        let expected_header =
            format_section_header(seed_section.section_path, seed_section.is_item_list);
        match (seed_section.is_item_list, section_value) {
            (false, toml::Value::Table(section_table)) => {
                self.count_item(seed_section.item_kind);
                self.check_table_values(section_table, section_location);
            }
            (true, toml::Value::Array(section_items)) => {
                for (item_index, section_item) in section_items.iter().enumerate() {
                    let item_location = format!("{section_location}[{item_index}]");
                    match section_item {
                        toml::Value::Table(item_table) => {
                            self.count_item(seed_section.item_kind);
                            self.check_table_values(item_table, &item_location);
                        }
                        _ => self.add_problem(
                            &item_location,
                            format!("Each {expected_header} item must be a table"),
                        ),
                    }
                }
            }
            _ => self.add_problem(
                section_location,
                format!("Write this section as {expected_header}"),
            ),
        }
    }

    fn count_item(&mut self, item_kind: &'static str) {
        *self.item_counts.entry(item_kind).or_insert(0) += 1;
    }

    fn check_table_values(&mut self, table: &toml::Table, table_location: &str) {
        for (key, value) in table {
            self.check_value(key, value, &join_location(table_location, key));
        }
    }

    fn check_value(&mut self, key: &str, value: &toml::Value, value_location: &str) {
        match value {
            toml::Value::String(text) => {
                if let Some(message) = check_seed_string(key, text) {
                    self.add_problem(value_location, message);
                }
            }
            toml::Value::Array(items) => {
                for (item_index, item) in items.iter().enumerate() {
                    self.check_value(key, item, &format!("{value_location}[{item_index}]"));
                }
            }
            toml::Value::Table(table) => self.check_table_values(table, value_location),
            toml::Value::Integer(_)
            | toml::Value::Float(_)
            | toml::Value::Boolean(_)
            | toml::Value::Datetime(_) => {}
        }
    }

    fn finish(mut self) -> SetupCheck {
        self.problems
            .sort_by_key(|setup_problem| setup_problem.line.unwrap_or(usize::MAX));
        let summary = SEED_SECTIONS
            .iter()
            .filter_map(|seed_section| {
                self.item_counts
                    .get(seed_section.item_kind)
                    .map(|item_count| SeedItemCount {
                        item_kind: seed_section.item_kind,
                        item_count: *item_count,
                    })
            })
            .collect();
        SetupCheck {
            problems: self.problems,
            summary,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_SEED_FILE: &str = r#"[settings]
sms_simulation_profile = "realistic"

[[webhook.endpoints]]
name = "Laravel inbound mail"
url = "http://localhost:8000/webhooks/mail"
secret = "${LARAVEL_INBOUND_MAIL_SECRET}"

[[verify.services]]
sid = "VA00000000000000000000000000000001"
name = "Login"
fixed_code = "123456"

[[verify.services]]
sid = "VA00000000000000000000000000000002"
name = "Signup"
"#;

    fn error_lines(seed_validation: &SeedValidation) -> Vec<usize> {
        seed_validation
            .errors
            .iter()
            .map(|error| error.line)
            .collect()
    }

    #[test]
    fn accepts_a_valid_file_and_counts_its_items() {
        let seed_validation = validate_seed_toml(VALID_SEED_FILE);

        assert!(seed_validation.is_valid);
        assert_eq!(
            seed_validation.summary,
            vec![
                SeedItemCount {
                    item_kind: "Settings",
                    item_count: 1
                },
                SeedItemCount {
                    item_kind: "Webhook endpoint",
                    item_count: 1
                },
                SeedItemCount {
                    item_kind: "Verify service",
                    item_count: 2
                },
            ]
        );
    }

    #[test]
    fn accepts_an_empty_file() {
        let seed_validation = validate_seed_toml("# nothing yet\n");

        assert!(seed_validation.is_valid);
        assert!(seed_validation.summary.is_empty());
    }

    // AC: PL-04.5
    #[test]
    fn reports_a_syntax_error_on_its_line() {
        let seed_validation =
            validate_seed_toml("[settings]\nsms_simulation_profile = realistic\n");

        assert!(!seed_validation.is_valid);
        assert_eq!(error_lines(&seed_validation), [2]);
    }

    // AC: PL-04.5
    #[test]
    fn reports_an_unknown_section_on_its_line() {
        let seed_validation =
            validate_seed_toml("[settings]\n\n[[webhook.endpoint]]\nname = \"typo\"\n");

        assert_eq!(error_lines(&seed_validation), [3]);
        assert_eq!(
            seed_validation.errors[0].message,
            "Unknown section [[webhook.endpoint]]"
        );
    }

    #[test]
    fn reports_a_section_written_in_the_wrong_shape() {
        let seed_validation = validate_seed_toml("[numbers]\nnumber = \"+15550001111\"\n");

        assert_eq!(
            seed_validation.errors[0].message,
            "Write this section as [[numbers]]"
        );
    }

    // AC: PL-04.5
    #[test]
    fn reports_a_literal_secret_on_its_line() {
        let seed_validation = validate_seed_toml(
            "[[webhook.endpoints]]\nname = \"App\"\nurl = \"http://localhost\"\nsecret = \"whsec_abc\"\n",
        );

        assert_eq!(error_lines(&seed_validation), [4]);
    }

    // AC: PL-18.1
    #[test]
    fn accepts_the_header_an_export_writes_without_counting_it() {
        let seed_validation = validate_seed_toml(
            "[sendmock]\nformat = \"sendmock.setup\"\nformat_version = 2\nexported_by = \"1.3.0\"\nexported_at = \"2026-11-20T10:00:00Z\"\n\n[[numbers]]\nnumber = \"+15550001111\"\n",
        );

        assert!(seed_validation.is_valid, "{:?}", seed_validation.errors);
        assert_eq!(seed_validation.summary.len(), 1);
    }

    // AC: PL-18.4
    #[test]
    fn reports_a_format_newer_than_this_build_reads_on_the_header_line() {
        let seed_validation = validate_seed_toml(
            "[[numbers]]\nnumber = \"+15550001111\"\n\n[sendmock]\nformat = \"sendmock.setup\"\nformat_version = 99\nexported_by = \"9.0.0\"\n",
        );

        assert_eq!(error_lines(&seed_validation), [4]);
        assert!(
            seed_validation.errors[0]
                .message
                .contains("exported by SendMock 9.0.0 (format 99)"),
            "{:?}",
            seed_validation.errors
        );
    }

    #[test]
    fn reports_an_unknown_header_key() {
        let seed_validation = validate_seed_toml(
            "[sendmock]\nformat = \"sendmock.setup\"\nformat_version = 2\nversion = 2\n",
        );

        assert!(!seed_validation.is_valid);
        assert!(
            seed_validation.errors[0]
                .message
                .starts_with("Unknown key version")
        );
    }

    #[test]
    fn lists_errors_in_line_order() {
        let seed_validation = validate_seed_toml(
            "[[mystery]]\nkey = 1\n\n[[webhook.endpoints]]\nsecret = \"plain\"\n",
        );

        assert_eq!(error_lines(&seed_validation), [1, 5]);
    }

    // AC: PL-18.5
    #[test]
    fn checks_json_and_yaml_with_the_same_rules_and_names_the_key_path() {
        let json_check = check_setup_text(
            r#"{"webhook": {"endpoints": [{"name": "App", "url": "http://localhost", "secret": "whsec_abc"}]}, "mystery": []}"#,
            SetupFileFormat::Json,
        );
        let yaml_check = check_setup_text(
            "webhook:\n  endpoints:\n    - name: App\n      url: http://localhost\n      secret: whsec_abc\nmystery: []\n",
            SetupFileFormat::Yaml,
        );

        for setup_check in [&json_check, &yaml_check] {
            let locations: Vec<Option<&str>> = setup_check
                .problems
                .iter()
                .map(|setup_problem| setup_problem.location.as_deref())
                .collect();
            assert_eq!(
                locations,
                [Some("webhook.endpoints[0].secret"), Some("mystery")],
                "{setup_check:?}"
            );
            assert!(
                setup_check
                    .problems
                    .iter()
                    .all(|setup_problem| setup_problem.line.is_none())
            );
            assert_eq!(
                setup_check.problems[1].message,
                "Unknown section [[mystery]]"
            );
        }
    }

    #[test]
    fn counts_the_items_of_a_yaml_file() {
        let setup_check = check_setup_text(
            "settings:\n  max_emails: 50\nverify:\n  services:\n    - name: Login\n    - name: Signup\n",
            SetupFileFormat::Yaml,
        );

        assert!(setup_check.is_valid(), "{setup_check:?}");
        assert_eq!(
            setup_check.summary,
            vec![
                SeedItemCount {
                    item_kind: "Settings",
                    item_count: 1
                },
                SeedItemCount {
                    item_kind: "Verify service",
                    item_count: 2
                },
            ]
        );
    }

    #[test]
    fn reports_a_json_syntax_error_on_its_line() {
        let setup_check = check_setup_text("{\n  \"numbers\": [,]\n}\n", SetupFileFormat::Json);

        assert!(!setup_check.is_valid());
        assert_eq!(setup_check.problems[0].line, Some(2));
    }
}
