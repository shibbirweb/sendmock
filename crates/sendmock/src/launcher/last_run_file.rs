//! `last-run.toml` in SendMock's config folder: the services the launcher last started, one
//! key per line with the format version. It holds addresses only, never secrets.

use std::fmt::Write as _;
use std::io;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};

use super::launch_choice::LaunchChoice;
use super::launch_service::LaunchService;

const LAST_RUN_FORMAT_VERSION: i64 = 1;
const LAST_RUN_FILE_NAME: &str = "last-run.toml";
const CONFIG_SUBDIRECTORY: &str = "sendmock";

/// What reading the file found.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LastRunRead {
    Missing,
    Saved(LaunchChoice),
    /// A corrupt file or one from a newer SendMock, with the reason; the defaults are used.
    Unusable(String),
}

/// `<OS config folder>/sendmock/last-run.toml`, beside `sendmock.toml`.
pub fn locate_last_run_file(os_config_directory: Option<&Path>) -> Option<PathBuf> {
    os_config_directory.map(|config_directory| {
        config_directory
            .join(CONFIG_SUBDIRECTORY)
            .join(LAST_RUN_FILE_NAME)
    })
}

pub fn read_last_run(file_path: &Path) -> LastRunRead {
    match std::fs::read_to_string(file_path) {
        Ok(file_text) => parse_last_run(&file_text),
        Err(read_error) if read_error.kind() == io::ErrorKind::NotFound => LastRunRead::Missing,
        Err(read_error) => LastRunRead::Unusable(read_error.to_string()),
    }
}

fn parse_last_run(file_text: &str) -> LastRunRead {
    let file_table: toml::Table = match toml::from_str(file_text) {
        Ok(file_table) => file_table,
        Err(parse_error) => return LastRunRead::Unusable(parse_error.message().to_owned()),
    };
    match file_table.get("version").and_then(toml::Value::as_integer) {
        Some(LAST_RUN_FORMAT_VERSION) => {}
        Some(newer_version) if newer_version > LAST_RUN_FORMAT_VERSION => {
            return LastRunRead::Unusable(format!(
                "it was written by a newer SendMock (format {newer_version})"
            ));
        }
        _ => return LastRunRead::Unusable("it has no format version".to_owned()),
    }
    let mut services = Vec::new();
    for (key, value) in file_table.iter().filter(|(key, _)| *key != "version") {
        let Some(service) = LaunchService::parse(key) else {
            return LastRunRead::Unusable(format!("{key} is not a service"));
        };
        let Some(address) = value
            .as_str()
            .and_then(|text| text.parse::<SocketAddr>().ok())
        else {
            return LastRunRead::Unusable(format!("{key} is not a HOST:PORT address"));
        };
        services.push((service, address));
    }
    LastRunRead::Saved(LaunchChoice::from_services(services))
}

fn render_last_run(launch_choice: &LaunchChoice) -> String {
    let mut file_text = format!(
        "# The services `sendmock` last started; `sendmock last-run clear` deletes this file.\nversion = {LAST_RUN_FORMAT_VERSION}\n"
    );
    for (service, address) in &launch_choice.addresses {
        let _ = writeln!(file_text, "{} = \"{address}\"", service.name());
    }
    file_text
}

pub fn write_last_run(file_path: &Path, launch_choice: &LaunchChoice) -> io::Result<()> {
    if let Some(parent_directory) = file_path.parent() {
        std::fs::create_dir_all(parent_directory)?;
    }
    std::fs::write(file_path, render_last_run(launch_choice))
}

/// Deletes the file; `false` when there was none.
pub fn delete_last_run(file_path: &Path) -> io::Result<bool> {
    match std::fs::remove_file(file_path) {
        Ok(()) => Ok(true),
        Err(remove_error) if remove_error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(remove_error) => Err(remove_error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-22.4
    #[test]
    fn a_saved_choice_reads_back_the_same() -> io::Result<()> {
        let working_directory = tempfile::tempdir()?;
        let file_path = working_directory
            .path()
            .join("sendmock")
            .join("last-run.toml");
        let launch_choice = LaunchChoice::from_services([(
            LaunchService::Catcher,
            LaunchService::Catcher.default_address(),
        )]);

        write_last_run(&file_path, &launch_choice)?;

        assert_eq!(read_last_run(&file_path), LastRunRead::Saved(launch_choice));
        let file_text = std::fs::read_to_string(&file_path)?;
        assert!(file_text.contains("version = 1\n"), "{file_text}");
        assert!(
            file_text.contains("catcher = \"127.0.0.1:8030\"\n"),
            "{file_text}"
        );
        Ok(())
    }

    // AC: PL-22.4
    #[test]
    fn a_corrupt_or_newer_file_is_not_used() {
        for (file_text, expected_reason) in [
            ("version = 2\nsmtp = \"127.0.0.1:1025\"\n", "newer SendMock"),
            ("version = 1\nsmtp = \"not an address\"\n", "HOST:PORT"),
            ("version = 1\nftp = \"127.0.0.1:21\"\n", "not a service"),
            ("this is not toml", ""),
        ] {
            let LastRunRead::Unusable(reason) = parse_last_run(file_text) else {
                panic!("{file_text} should not be usable");
            };
            assert!(reason.contains(expected_reason), "{reason}");
        }
    }

    // AC: PL-22.7
    #[test]
    fn clearing_deletes_the_file_and_is_fine_when_there_is_none() -> io::Result<()> {
        let working_directory = tempfile::tempdir()?;
        let file_path = working_directory.path().join("last-run.toml");
        write_last_run(&file_path, &LaunchChoice::defaults())?;

        assert!(delete_last_run(&file_path)?);
        assert!(!delete_last_run(&file_path)?);
        assert_eq!(read_last_run(&file_path), LastRunRead::Missing);
        Ok(())
    }
}
