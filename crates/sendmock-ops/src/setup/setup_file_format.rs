use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// The text formats a setup file can be written in; all three hold the same structure, so a
/// file converts between them without loss.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum SetupFileFormat {
    #[default]
    Toml,
    Json,
    Yaml,
}

impl SetupFileFormat {
    pub const ALL: [Self; 3] = [Self::Toml, Self::Json, Self::Yaml];

    /// Reads `--format`: `toml`, `json`, `yaml` or `yml`, in any case.
    pub fn from_format_name(format_name: &str) -> Option<Self> {
        match format_name.trim().to_ascii_lowercase().as_str() {
            "toml" => Some(Self::Toml),
            "json" => Some(Self::Json),
            "yaml" | "yml" => Some(Self::Yaml),
            _ => None,
        }
    }

    /// The format a file name's extension names, such as `setup.yaml`.
    pub fn from_file_name(file_name: &str) -> Option<Self> {
        let (_, extension) = file_name.rsplit_once('.')?;
        Self::from_format_name(extension)
    }

    /// The format of pasted text or a download without a usable name. JSON starts with `{`;
    /// YAML is chosen only when the text is not TOML and reads as a YAML mapping, so a broken
    /// TOML file still gets TOML's error.
    pub fn detect(setup_text: &str) -> Self {
        if setup_text.trim_start().starts_with('{') {
            return Self::Json;
        }
        if setup_text.parse::<toml::Table>().is_ok() {
            return Self::Toml;
        }
        let is_yaml_mapping = matches!(
            serde_yaml_ng::from_str::<serde_yaml_ng::Value>(setup_text),
            Ok(serde_yaml_ng::Value::Mapping(_))
        );
        if is_yaml_mapping {
            Self::Yaml
        } else {
            Self::Toml
        }
    }

    pub fn file_extension(self) -> &'static str {
        match self {
            Self::Toml => "toml",
            Self::Json => "json",
            Self::Yaml => "yaml",
        }
    }

    pub fn content_type(self) -> &'static str {
        match self {
            Self::Toml => "application/toml",
            Self::Json => "application/json",
            Self::Yaml => "application/yaml",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-18.5
    #[test]
    fn chooses_the_format_by_name_or_file_extension() {
        assert_eq!(
            SetupFileFormat::from_format_name("YAML"),
            Some(SetupFileFormat::Yaml)
        );
        assert_eq!(
            SetupFileFormat::from_format_name("yml"),
            Some(SetupFileFormat::Yaml)
        );
        assert_eq!(SetupFileFormat::from_format_name("xml"), None);
        assert_eq!(
            SetupFileFormat::from_file_name("team.setup.json"),
            Some(SetupFileFormat::Json)
        );
        assert_eq!(
            SetupFileFormat::from_file_name("sendmock.seed.toml"),
            Some(SetupFileFormat::Toml)
        );
        assert_eq!(SetupFileFormat::from_file_name("setup"), None);
    }

    #[test]
    fn detects_pasted_text() {
        assert_eq!(
            SetupFileFormat::detect("  {\"numbers\": []}"),
            SetupFileFormat::Json
        );
        assert_eq!(
            SetupFileFormat::detect("[[numbers]]\nnumber = \"+15550001111\"\n"),
            SetupFileFormat::Toml
        );
        assert_eq!(
            SetupFileFormat::detect("numbers:\n  - number: \"+15550001111\"\n"),
            SetupFileFormat::Yaml
        );
        assert_eq!(
            SetupFileFormat::detect("[settings]\nmax_emails = \n"),
            SetupFileFormat::Toml
        );
    }

    #[test]
    fn names_the_extension_and_content_type() {
        assert_eq!(SetupFileFormat::Yaml.file_extension(), "yaml");
        assert_eq!(SetupFileFormat::Json.content_type(), "application/json");
    }
}
