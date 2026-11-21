use serde::{Serialize, Serializer};

use super::setup_file_format::SetupFileFormat;
use super::setup_header::HEADER_KEY;
use crate::OperationError;
use crate::seed::{SeedSection, write_section_toml};

/// The note an export starts with, in the formats that keep comments.
const EXPORT_COMMENT: &str =
    "# SendMock setup file.\n# Secrets are ${ENV_VAR} references: set them in the environment.\n";

/// One section of an export and its items, in apply order.
pub struct ExportedSection {
    pub seed_section: &'static SeedSection,
    pub items: Vec<toml::Table>,
}

/// An export in the chosen format: the header first, then each section in apply order. TOML
/// writes each section as its own `[[path]]` tables; JSON and YAML nest the sections under
/// their groups (`webhook.endpoints` under `webhook`), the same structure TOML describes.
pub fn write_setup_export(
    setup_header: toml::Table,
    exported_sections: Vec<ExportedSection>,
    setup_format: SetupFileFormat,
) -> Result<String, OperationError> {
    if setup_format == SetupFileFormat::Toml {
        let mut header_document = toml::Table::new();
        header_document.insert(HEADER_KEY.to_owned(), setup_header.into());
        let mut section_texts = vec![
            EXPORT_COMMENT.to_owned(),
            toml::to_string(&header_document).map_err(write_failed)?,
        ];
        for exported_section in exported_sections {
            section_texts.push(
                write_section_toml(exported_section.seed_section, exported_section.items)
                    .map_err(write_failed)?,
            );
        }
        return Ok(section_texts.join("\n"));
    }
    let setup_document = nest_sections(setup_header, exported_sections);
    write_setup_document(&setup_document, setup_format)
}

/// A parsed setup file written in the chosen format, as `setup migrate` and a format
/// conversion write it.
pub fn write_setup_document(
    setup_document: &toml::Table,
    setup_format: SetupFileFormat,
) -> Result<String, OperationError> {
    let portable_document = PortableTable(setup_document);
    match setup_format {
        SetupFileFormat::Toml => toml::to_string(setup_document).map_err(write_failed),
        SetupFileFormat::Json => serde_json::to_string_pretty(&portable_document)
            .map(|json_text| format!("{json_text}\n"))
            .map_err(|write_error| OperationError::Internal(write_error.to_string())),
        SetupFileFormat::Yaml => serde_yaml_ng::to_string(&portable_document)
            .map(|yaml_text| format!("{EXPORT_COMMENT}{yaml_text}"))
            .map_err(|write_error| OperationError::Internal(write_error.to_string())),
    }
}

fn write_failed(write_error: toml::ser::Error) -> OperationError {
    OperationError::Internal(write_error.to_string())
}

/// The header and sections as one table, each section at its path.
fn nest_sections(
    setup_header: toml::Table,
    exported_sections: Vec<ExportedSection>,
) -> toml::Table {
    let mut setup_document = toml::Table::new();
    setup_document.insert(HEADER_KEY.to_owned(), setup_header.into());
    for exported_section in exported_sections {
        let seed_section = exported_section.seed_section;
        let section_value = if seed_section.is_item_list {
            toml::Value::Array(
                exported_section
                    .items
                    .into_iter()
                    .map(toml::Value::Table)
                    .collect(),
            )
        } else {
            toml::Value::Table(
                exported_section
                    .items
                    .into_iter()
                    .next()
                    .unwrap_or_default(),
            )
        };
        insert_at_path(
            &mut setup_document,
            seed_section.section_path,
            section_value,
        );
    }
    setup_document
}

fn insert_at_path(
    setup_document: &mut toml::Table,
    section_path: &str,
    section_value: toml::Value,
) {
    let mut path_parts: Vec<&str> = section_path.split('.').collect();
    let Some(last_part) = path_parts.pop() else {
        return;
    };
    let mut current_table = setup_document;
    for group_name in path_parts {
        let group_value = current_table
            .entry(group_name.to_owned())
            .or_insert_with(|| toml::Value::Table(toml::Table::new()));
        let toml::Value::Table(group_table) = group_value else {
            return;
        };
        current_table = group_table;
    }
    current_table.insert(last_part.to_owned(), section_value);
}

/// Writes a TOML table through any serde format; a TOML date, which JSON and YAML do not
/// have, is written as its text.
struct PortableTable<'document>(&'document toml::Table);

struct PortableTomlValue<'document>(&'document toml::Value);

impl Serialize for PortableTable<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_map(
            self.0
                .iter()
                .map(|(key, value)| (key, PortableTomlValue(value))),
        )
    }
}

impl Serialize for PortableTomlValue<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self.0 {
            toml::Value::String(text) => serializer.serialize_str(text),
            toml::Value::Integer(integer) => serializer.serialize_i64(*integer),
            toml::Value::Float(float) => serializer.serialize_f64(*float),
            toml::Value::Boolean(flag) => serializer.serialize_bool(*flag),
            toml::Value::Datetime(datetime) => serializer.collect_str(datetime),
            toml::Value::Array(items) => {
                serializer.collect_seq(items.iter().map(PortableTomlValue))
            }
            toml::Value::Table(table) => PortableTable(table).serialize(serializer),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::seed::{NUMBERS_SECTION, SETTINGS_SECTION, VERIFY_SERVICES_SECTION};
    use crate::setup::{build_setup_header, read_setup_document};

    fn parse(setup_toml: &str) -> toml::Table {
        setup_toml
            .parse()
            .unwrap_or_else(|error| panic!("a setup: {error}"))
    }

    fn exported_sections() -> Vec<ExportedSection> {
        vec![
            ExportedSection {
                seed_section: &SETTINGS_SECTION,
                items: vec![parse("max_emails = 50\n")],
            },
            ExportedSection {
                seed_section: &VERIFY_SERVICES_SECTION,
                items: vec![parse("name = \"Login\"\nfixed_code = \"123456\"\n")],
            },
            ExportedSection {
                seed_section: &NUMBERS_SECTION,
                items: vec![parse("number = \"+15550001111\"\nlabel = \"Support\"\n")],
            },
        ]
    }

    fn export_in(setup_format: SetupFileFormat) -> String {
        write_setup_export(
            build_setup_header(2, Some("1.3.0"), Some("2026-11-20T10:00:00Z")),
            exported_sections(),
            setup_format,
        )
        .unwrap_or_else(|error| panic!("an export: {error}"))
    }

    // AC: PL-18.5
    #[test]
    fn every_format_reads_back_as_the_same_setup() {
        let read_export = |setup_format: SetupFileFormat| {
            read_setup_document(&export_in(setup_format), setup_format)
                .unwrap_or_else(|problem| panic!("{setup_format:?}: {problem:?}"))
        };
        let toml_setup = read_export(SetupFileFormat::Toml);

        for setup_format in [SetupFileFormat::Json, SetupFileFormat::Yaml] {
            assert_eq!(read_export(setup_format), toml_setup, "{setup_format:?}");
        }
    }

    // AC: PL-18.5
    #[test]
    fn a_document_converts_between_formats_without_loss() {
        let setup_document = parse(
            "[sendmock]\nformat = \"sendmock.setup\"\nformat_version = 2\n\n[settings]\nsms_failure_rate_percent = 5\nemail_outcome_bounce_rate = 2.5\n\n[[webhook.endpoints]]\nname = \"App\"\nurl = \"http://localhost:8000\"\nenabled = false\nheaders = { \"x-team\" = \"qa\" }\n\n[[webhook.templates]]\nid = \"custom.note\"\nbody = \"\"\"\n{\"line\": 1}\n\"\"\"\n",
        );

        for setup_format in SetupFileFormat::ALL {
            let written_text = write_setup_document(&setup_document, setup_format)
                .unwrap_or_else(|error| panic!("{setup_format:?}: {error}"));
            let read_back = read_setup_document(&written_text, setup_format)
                .unwrap_or_else(|problem| panic!("{setup_format:?}: {problem:?}"));
            assert_eq!(
                read_back, setup_document,
                "{setup_format:?}:\n{written_text}"
            );
        }
    }

    #[test]
    fn writes_the_header_first_and_nests_sections_under_their_group() {
        let json_export = export_in(SetupFileFormat::Json);
        let json_value: serde_json::Value =
            serde_json::from_str(&json_export).unwrap_or_else(|error| panic!("JSON: {error}"));

        assert!(
            json_export.trim_start().starts_with("{\n  \"sendmock\""),
            "{json_export}"
        );
        assert_eq!(json_value["verify"]["services"][0]["name"], "Login");
        assert_eq!(json_value["settings"]["max_emails"], 50);
        assert!(export_in(SetupFileFormat::Yaml).starts_with("# SendMock setup file."));
    }

    #[test]
    fn writes_a_toml_date_as_text() {
        let setup_document = parse("[sendmock]\nexported_at = 2026-11-20T10:00:00Z\n");

        let json_text = write_setup_document(&setup_document, SetupFileFormat::Json)
            .unwrap_or_else(|error| panic!("JSON: {error}"));

        assert!(
            json_text.contains("\"exported_at\": \"2026-11-20T10:00:00Z\""),
            "{json_text}"
        );
    }
}
