/// The `format` every setup file names in its header.
pub const SETUP_FORMAT_NAME: &str = "sendmock.setup";
/// The format version this build writes; raised only when a section or key changes shape.
pub const CURRENT_FORMAT_VERSION: i64 = 2;
/// The top-level table that holds the header.
pub const HEADER_KEY: &str = "sendmock";
/// A file without the header is a seed file from before setup files had versions.
const HEADERLESS_FORMAT_VERSION: i64 = 1;

const FORMAT_KEY: &str = "format";
const FORMAT_VERSION_KEY: &str = "format_version";
const EXPORTED_BY_KEY: &str = "exported_by";
const EXPORTED_AT_KEY: &str = "exported_at";
const HEADER_KEYS: [&str; 4] = [
    FORMAT_KEY,
    FORMAT_VERSION_KEY,
    EXPORTED_BY_KEY,
    EXPORTED_AT_KEY,
];

/// What the header says about the file: its format version and the SendMock that wrote it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SetupHeader {
    pub format_version: i64,
    pub exported_by: Option<String>,
}

impl SetupHeader {
    /// Reads the header of a parsed file; a file without one is format 1.
    pub fn read(setup_document: &toml::Table) -> Self {
        let header_table = setup_document
            .get(HEADER_KEY)
            .and_then(toml::Value::as_table);
        let Some(header_table) = header_table else {
            return Self {
                format_version: HEADERLESS_FORMAT_VERSION,
                exported_by: None,
            };
        };
        Self {
            format_version: header_table
                .get(FORMAT_VERSION_KEY)
                .and_then(toml::Value::as_integer)
                .unwrap_or(HEADERLESS_FORMAT_VERSION),
            exported_by: header_table
                .get(EXPORTED_BY_KEY)
                .and_then(toml::Value::as_str)
                .map(str::to_owned),
        }
    }
}

/// The header an export writes; `exported_by` and `exported_at` are left out when unknown,
/// as a migration does not know who wrote the file.
pub fn build_setup_header(
    format_version: i64,
    exported_by: Option<&str>,
    exported_at: Option<&str>,
) -> toml::Table {
    let mut header_table = toml::Table::new();
    header_table.insert(FORMAT_KEY.to_owned(), SETUP_FORMAT_NAME.into());
    header_table.insert(FORMAT_VERSION_KEY.to_owned(), format_version.into());
    if let Some(exported_by) = exported_by {
        header_table.insert(EXPORTED_BY_KEY.to_owned(), exported_by.into());
    }
    if let Some(exported_at) = exported_at {
        header_table.insert(EXPORTED_AT_KEY.to_owned(), exported_at.into());
    }
    header_table
}

/// What is wrong with a header key, if anything: an unknown key, another format, or a
/// version that is not a whole number from 1.
pub fn check_setup_header(header_key: &str, header_value: &toml::Value) -> Option<String> {
    if !HEADER_KEYS.contains(&header_key) {
        return Some(format!(
            "Unknown key {header_key} in [{HEADER_KEY}]; it holds {}",
            HEADER_KEYS.join(", ")
        ));
    }
    let is_valid = match header_key {
        FORMAT_KEY => header_value.as_str() == Some(SETUP_FORMAT_NAME),
        FORMAT_VERSION_KEY => header_value
            .as_integer()
            .is_some_and(|format_version| format_version >= HEADERLESS_FORMAT_VERSION),
        EXPORTED_BY_KEY => header_value.is_str(),
        _ => header_value.is_str() || header_value.is_datetime(),
    };
    if is_valid {
        return None;
    }
    Some(match header_key {
        FORMAT_KEY => format!("{FORMAT_KEY} must be \"{SETUP_FORMAT_NAME}\""),
        FORMAT_VERSION_KEY => format!("{FORMAT_VERSION_KEY} must be a whole number from 1"),
        _ => format!("{header_key} must be text"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(setup_toml: &str) -> toml::Table {
        setup_toml
            .parse()
            .unwrap_or_else(|error| panic!("a setup: {error}"))
    }

    // AC: PL-18.2
    #[test]
    fn reads_a_file_without_a_header_as_format_one() {
        let setup_header = SetupHeader::read(&parse("[[numbers]]\nnumber = \"+15550001111\"\n"));

        assert_eq!(
            setup_header,
            SetupHeader {
                format_version: 1,
                exported_by: None
            }
        );
    }

    // AC: PL-18.1
    #[test]
    fn reads_back_the_header_an_export_writes() {
        let mut setup_document = toml::Table::new();
        setup_document.insert(
            HEADER_KEY.to_owned(),
            build_setup_header(2, Some("1.3.0"), Some("2026-11-20T10:00:00Z")).into(),
        );

        assert_eq!(
            SetupHeader::read(&setup_document),
            SetupHeader {
                format_version: 2,
                exported_by: Some("1.3.0".to_owned())
            }
        );
    }

    #[test]
    fn names_what_is_wrong_with_a_header_key() {
        assert_eq!(check_setup_header("format", &"sendmock.setup".into()), None);
        assert!(check_setup_header("format", &"other".into()).is_some());
        assert!(check_setup_header("format_version", &0.into()).is_some());
        assert!(check_setup_header("version", &2.into()).is_some());
    }
}
