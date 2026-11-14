use std::collections::BTreeMap;

use toml::Spanned;
use toml::de::{DeTable, DeValue};

use super::seed_line_index::SeedLineIndex;
use super::seed_sections::{
    SEED_SECTIONS, SeedSection, find_seed_section, format_section_header, is_section_group,
};
use super::seed_string_rules::check_seed_string;
use super::{SeedItemCount, SeedValidation, SeedValidationError};

/// Collects problems with their line numbers, and counts the items per kind.
struct SeedValidationReport {
    line_index: SeedLineIndex,
    errors: Vec<SeedValidationError>,
    item_counts: BTreeMap<&'static str, usize>,
}

/// Checks a seed file without applying anything: TOML syntax, known sections, the shape of
/// each section, and `${ENV_VAR}` references and secrets in every string.
pub fn validate_seed_toml(seed_toml: &str) -> SeedValidation {
    let mut report = SeedValidationReport {
        line_index: SeedLineIndex::new(seed_toml),
        errors: Vec::new(),
        item_counts: BTreeMap::new(),
    };
    let (seed_document, syntax_errors) = DeTable::parse_recoverable(seed_toml);
    for syntax_error in syntax_errors {
        let byte_offset = syntax_error.span().map_or(0, |span| span.start);
        report.add_error(byte_offset, syntax_error.message().to_owned());
    }
    for (section_key, section_value) in seed_document.get_ref() {
        report.check_top_level_entry(section_key, section_value);
    }
    report.finish()
}

impl SeedValidationReport {
    fn add_error(&mut self, byte_offset: usize, message: String) {
        self.errors.push(SeedValidationError {
            line: self.line_index.line_of(byte_offset),
            message,
        });
    }

    fn check_top_level_entry(
        &mut self,
        section_key: &Spanned<std::borrow::Cow<'_, str>>,
        section_value: &Spanned<DeValue<'_>>,
    ) {
        let key_name = section_key.get_ref().as_ref();
        if let Some(seed_section) = find_seed_section(key_name) {
            self.check_section(seed_section, section_key.span().start, section_value);
            return;
        }
        match (is_section_group(key_name), section_value.get_ref()) {
            (true, DeValue::Table(group_table)) => {
                for (sub_key, sub_value) in group_table {
                    let section_path = format!("{key_name}.{}", sub_key.get_ref());
                    match find_seed_section(&section_path) {
                        Some(seed_section) => {
                            self.check_section(seed_section, sub_key.span().start, sub_value)
                        }
                        None => self.report_unknown_section(
                            &section_path,
                            sub_key.span().start,
                            sub_value,
                        ),
                    }
                }
            }
            _ => self.report_unknown_section(key_name, section_key.span().start, section_value),
        }
    }

    fn report_unknown_section(
        &mut self,
        section_path: &str,
        byte_offset: usize,
        section_value: &Spanned<DeValue<'_>>,
    ) {
        let is_item_list = matches!(section_value.get_ref(), DeValue::Array(_));
        let section_header = format_section_header(section_path, is_item_list);
        self.add_error(byte_offset, format!("Unknown section {section_header}"));
    }

    fn check_section(
        &mut self,
        seed_section: &'static SeedSection,
        byte_offset: usize,
        section_value: &Spanned<DeValue<'_>>,
    ) {
        let expected_header =
            format_section_header(seed_section.section_path, seed_section.is_item_list);
        match (seed_section.is_item_list, section_value.get_ref()) {
            (false, DeValue::Table(section_table)) => {
                self.count_item(seed_section.item_kind);
                self.check_table_values(section_table);
            }
            (true, DeValue::Array(section_items)) => {
                for section_item in section_items {
                    match section_item.get_ref() {
                        DeValue::Table(item_table) => {
                            self.count_item(seed_section.item_kind);
                            self.check_table_values(item_table);
                        }
                        _ => self.add_error(
                            section_item.span().start,
                            format!("Each {expected_header} item must be a table"),
                        ),
                    }
                }
            }
            _ => self.add_error(
                byte_offset,
                format!("Write this section as {expected_header}"),
            ),
        }
    }

    fn count_item(&mut self, item_kind: &'static str) {
        *self.item_counts.entry(item_kind).or_insert(0) += 1;
    }

    fn check_table_values(&mut self, table: &DeTable<'_>) {
        for (key, value) in table {
            self.check_value(key.get_ref(), value);
        }
    }

    fn check_value(&mut self, key: &str, value: &Spanned<DeValue<'_>>) {
        match value.get_ref() {
            DeValue::String(text) => {
                if let Some(message) = check_seed_string(key, text) {
                    self.add_error(value.span().start, message);
                }
            }
            DeValue::Array(items) => {
                for item in items {
                    self.check_value(key, item);
                }
            }
            DeValue::Table(table) => self.check_table_values(table),
            DeValue::Integer(_)
            | DeValue::Float(_)
            | DeValue::Boolean(_)
            | DeValue::Datetime(_) => {}
        }
    }

    fn finish(mut self) -> SeedValidation {
        self.errors.sort_by_key(|error| error.line);
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
        SeedValidation {
            is_valid: self.errors.is_empty(),
            errors: self.errors,
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

    #[test]
    fn lists_errors_in_line_order() {
        let seed_validation = validate_seed_toml(
            "[[mystery]]\nkey = 1\n\n[[webhook.endpoints]]\nsecret = \"plain\"\n",
        );

        assert_eq!(error_lines(&seed_validation), [1, 5]);
    }
}
