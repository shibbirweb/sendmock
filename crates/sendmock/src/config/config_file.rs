use std::fs;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use super::{ConfigError, LogFormat, LogLevel};

/// `sendmock.toml`. Every key is optional; an unknown key is an error, so a typo never
/// goes unnoticed.
#[derive(Debug, Default, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConfigFile {
    pub http_addr: Option<SocketAddr>,
    pub smtp_addr: Option<SocketAddr>,
    pub smtps_addr: Option<SocketAddr>,
    pub smtp_max_size: Option<String>,
    pub smtp_auth: Option<String>,
    pub smtp_tls_cert: Option<PathBuf>,
    pub smtp_tls_key: Option<PathBuf>,
    pub smtp_require_tls: Option<bool>,
    pub smtp_allow_rcpt: Option<String>,
    pub max_emails: Option<u64>,
    pub max_age: Option<String>,
    pub db: Option<String>,
    pub log_format: Option<LogFormat>,
    pub log_level: Option<LogLevel>,
    pub seed: Option<PathBuf>,
}

impl ConfigFile {
    pub fn read(file_path: &Path) -> Result<Self, ConfigError> {
        let config_toml =
            fs::read_to_string(file_path).map_err(|source| ConfigError::UnreadableFile {
                file_path: file_path.to_path_buf(),
                source,
            })?;
        Self::parse(&config_toml, file_path)
    }

    pub fn parse(config_toml: &str, file_path: &Path) -> Result<Self, ConfigError> {
        toml::from_str(config_toml).map_err(|toml_error| ConfigError::InvalidFile {
            file_path: file_path.to_path_buf(),
            reason: toml_error.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_config(config_toml: &str) -> Result<ConfigFile, ConfigError> {
        ConfigFile::parse(config_toml, Path::new("sendmock.toml"))
    }

    #[test]
    fn reads_every_key() {
        let config_file = parse_config(
            r#"
            http_addr = "127.0.0.1:9025"
            smtp_addr = "127.0.0.1:9026"
            db = "memory"
            log_format = "json"
            log_level = "debug"
            seed = "sendmock.seed.toml"
            "#,
        );

        assert_eq!(
            config_file.ok(),
            Some(ConfigFile {
                http_addr: "127.0.0.1:9025".parse().ok(),
                smtp_addr: "127.0.0.1:9026".parse().ok(),
                db: Some("memory".to_owned()),
                log_format: Some(LogFormat::Json),
                log_level: Some(LogLevel::Debug),
                seed: Some(PathBuf::from("sendmock.seed.toml")),
                ..ConfigFile::default()
            })
        );
    }

    #[test]
    fn reads_an_empty_file_as_no_settings() {
        assert_eq!(parse_config("").ok(), Some(ConfigFile::default()));
    }

    // AC: PL-07.2
    #[test]
    fn rejects_an_unknown_key_and_names_it() {
        let error_message = parse_config("colour = \"blue\"")
            .err()
            .map(|config_error| config_error.to_string())
            .unwrap_or_default();

        assert!(error_message.contains("sendmock.toml"));
        assert!(error_message.contains("colour"));
    }

    // AC: PL-07.2
    #[test]
    fn rejects_an_invalid_value_and_names_the_key() {
        let error_message = parse_config("http_addr = \"not an address\"")
            .err()
            .map(|config_error| config_error.to_string())
            .unwrap_or_default();

        assert!(error_message.contains("http_addr"));
    }

    #[test]
    fn reports_a_missing_file() {
        let read_result = ConfigFile::read(Path::new("does-not-exist/sendmock.toml"));

        assert!(matches!(
            read_result,
            Err(ConfigError::UnreadableFile { .. })
        ));
    }
}
