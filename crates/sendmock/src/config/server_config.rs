use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};

use sendmock_api::AccessControlSettings;
use sendmock_store::DatabaseLocation;

use super::access_config::resolve_access_control;
use super::config_file::ConfigFile;
use super::config_file_locator::locate_config_file;
use super::provider_port_config::ProviderPortConfig;
use super::seed_file_locator::{CONTAINER_CONFIG_DIRECTORY, locate_seed_file};
use super::smtp_config::SmtpConfig;
use super::startup_settings_config::StartupSettingsConfig;
use super::{ConfigError, LogFormat, LogLevel};
use crate::cli_arguments::ServeArguments;

/// Only this machine can reach the defaults; Docker sets `0.0.0.0` through the environment.
pub const DEFAULT_HTTP_ADDR: SocketAddr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 8025);
pub const DEFAULT_SMTP_ADDR: SocketAddr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 1025);
const DATABASE_FILE_NAME: &str = "sendmock.db";
const OS_DATA_SUBDIRECTORY: &str = "sendmock";

/// The settings the server runs with, after flags, environment, file and defaults are merged.
#[derive(Debug, Clone, PartialEq)]
pub struct ServerConfig {
    pub http_addr: SocketAddr,
    pub smtp_addr: SocketAddr,
    pub smtp: SmtpConfig,
    pub provider_ports: ProviderPortConfig,
    pub startup_settings: StartupSettingsConfig,
    pub access_control: AccessControlSettings,
    pub database_location: DatabaseLocation,
    pub log_format: LogFormat,
    pub log_level: LogLevel,
    pub seed_file_path: Option<PathBuf>,
    pub config_file_path: Option<PathBuf>,
    /// `--ready-json`: the ready line on stdout, logs on stderr.
    pub prints_ready_json: bool,
}

impl ServerConfig {
    pub fn load(serve_arguments: &ServeArguments) -> Result<Self, ConfigError> {
        let current_directory = std::env::current_dir().unwrap_or_default();
        let config_file_path = locate_config_file(
            serve_arguments.config_file_path.as_deref(),
            &current_directory,
            dirs::config_dir().as_deref(),
            Path::new(CONTAINER_CONFIG_DIRECTORY),
        );
        let config_file = match &config_file_path {
            Some(file_path) => ConfigFile::read(file_path)?,
            None => ConfigFile::default(),
        };
        let mut server_config = Self::resolve(
            serve_arguments,
            config_file,
            config_file_path,
            default_database_location(dirs::data_dir().as_deref()),
        )?;
        server_config.seed_file_path = locate_seed_file(
            server_config.seed_file_path.as_deref(),
            &current_directory,
            Path::new(CONTAINER_CONFIG_DIRECTORY),
        );
        Ok(server_config)
    }

    /// Flags and environment variables (already merged by clap) win over the file, which
    /// wins over the defaults.
    pub fn resolve(
        serve_arguments: &ServeArguments,
        config_file: ConfigFile,
        config_file_path: Option<PathBuf>,
        default_database_location: DatabaseLocation,
    ) -> Result<Self, ConfigError> {
        let smtp = SmtpConfig::resolve(serve_arguments, &config_file)?;
        let startup_settings = StartupSettingsConfig::resolve(serve_arguments, &config_file)?;
        let access_control = resolve_access_control(serve_arguments, &config_file)?;
        let database_setting = serve_arguments
            .database_setting
            .clone()
            .or(config_file.db.clone());
        let http_addr = serve_arguments
            .http_addr
            .or(config_file.http_addr)
            .unwrap_or(DEFAULT_HTTP_ADDR);
        let provider_ports = ProviderPortConfig::resolve(serve_arguments, &config_file, http_addr)?;
        Ok(Self {
            http_addr,
            smtp_addr: serve_arguments
                .smtp_addr
                .or(config_file.smtp_addr)
                .unwrap_or(DEFAULT_SMTP_ADDR),
            smtp,
            provider_ports,
            startup_settings,
            access_control,
            database_location: database_setting
                .map(|setting| DatabaseLocation::from_setting(&setting))
                .unwrap_or(default_database_location),
            log_format: serve_arguments
                .log_format
                .or(config_file.log_format)
                .unwrap_or_default(),
            log_level: serve_arguments
                .log_level
                .or(config_file.log_level)
                .unwrap_or_default(),
            seed_file_path: serve_arguments.seed_file_path.clone().or(config_file.seed),
            config_file_path,
            prints_ready_json: serve_arguments.ready_json,
        })
    }

    /// Where the generated TLS certificate is kept: beside the database file, nowhere for
    /// an in-memory database.
    pub fn generated_files_folder(&self) -> Option<PathBuf> {
        match &self.database_location {
            DatabaseLocation::File(database_file_path) => {
                database_file_path.parent().map(Path::to_path_buf)
            }
            DatabaseLocation::InMemory => None,
        }
    }
}

/// `sendmock/sendmock.db` in the OS data folder, or the current folder when the OS has none.
pub fn default_database_location(os_data_directory: Option<&Path>) -> DatabaseLocation {
    let database_file_path = match os_data_directory {
        Some(directory) => directory
            .join(OS_DATA_SUBDIRECTORY)
            .join(DATABASE_FILE_NAME),
        None => PathBuf::from(DATABASE_FILE_NAME),
    };
    DatabaseLocation::File(database_file_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn resolve_config(serve_arguments: &ServeArguments, config_file: ConfigFile) -> ServerConfig {
        ServerConfig::resolve(
            serve_arguments,
            config_file,
            None,
            DatabaseLocation::File(PathBuf::from("default.db")),
        )
        .unwrap_or_else(|config_error| panic!("{config_error}"))
    }

    // AC: PL-06.1
    #[test]
    fn listens_on_this_machine_only_by_default() {
        let server_config = resolve_config(&ServeArguments::default(), ConfigFile::default());

        assert!(server_config.http_addr.ip().is_loopback());
        assert!(server_config.smtp_addr.ip().is_loopback());
        assert_eq!(server_config.http_addr.port(), 8025);
        assert_eq!(server_config.smtp_addr.port(), 1025);
    }

    // AC: PL-07.1
    #[test]
    fn a_flag_wins_over_the_file() {
        let serve_arguments = ServeArguments {
            http_addr: "127.0.0.1:7000".parse().ok(),
            log_format: Some(LogFormat::Human),
            ..ServeArguments::default()
        };
        let config_file = ConfigFile {
            http_addr: "127.0.0.1:8000".parse().ok(),
            log_format: Some(LogFormat::Json),
            ..ConfigFile::default()
        };

        let server_config = resolve_config(&serve_arguments, config_file);

        assert_eq!(server_config.http_addr.port(), 7000);
        assert_eq!(server_config.log_format, LogFormat::Human);
    }

    // AC: PL-07.1
    #[test]
    fn the_file_wins_over_the_defaults() {
        let config_file = ConfigFile {
            smtp_addr: "127.0.0.1:2525".parse().ok(),
            db: Some("memory".to_owned()),
            log_level: Some(LogLevel::Debug),
            ..ConfigFile::default()
        };

        let server_config = resolve_config(&ServeArguments::default(), config_file);

        assert_eq!(server_config.smtp_addr.port(), 2525);
        assert_eq!(server_config.database_location, DatabaseLocation::InMemory);
        assert_eq!(server_config.log_level, LogLevel::Debug);
    }

    #[test]
    fn keeps_the_database_in_the_os_data_folder_by_default() {
        let database_location = default_database_location(Some(Path::new("/data")));

        assert_eq!(
            database_location,
            DatabaseLocation::File(PathBuf::from("/data/sendmock/sendmock.db"))
        );
    }

    #[test]
    fn keeps_the_database_in_the_current_folder_without_an_os_data_folder() {
        assert_eq!(
            default_database_location(None),
            DatabaseLocation::File(PathBuf::from("sendmock.db"))
        );
    }
}
