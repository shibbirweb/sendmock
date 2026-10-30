use std::path::{Path, PathBuf};

pub const CONFIG_FILE_NAME: &str = "sendmock.toml";
const OS_CONFIG_SUBDIRECTORY: &str = "sendmock";

/// The file to read: the one named by `--config`, else `./sendmock.toml`, else
/// `sendmock/sendmock.toml` in the OS config folder, else `sendmock.toml` in the container
/// config folder (`/config`, where the Docker image expects mounts); `None` when there is none.
pub fn locate_config_file(
    explicit_file_path: Option<&Path>,
    current_directory: &Path,
    os_config_directory: Option<&Path>,
    container_config_directory: &Path,
) -> Option<PathBuf> {
    if let Some(explicit_file_path) = explicit_file_path {
        return Some(explicit_file_path.to_path_buf());
    }
    let os_config_file = os_config_directory.map(|directory| {
        directory
            .join(OS_CONFIG_SUBDIRECTORY)
            .join(CONFIG_FILE_NAME)
    });
    [
        Some(current_directory.join(CONFIG_FILE_NAME)),
        os_config_file,
        Some(container_config_directory.join(CONFIG_FILE_NAME)),
    ]
    .into_iter()
    .flatten()
    .find(|candidate_file| candidate_file.is_file())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    const MISSING_FOLDER: &str = "/no-such-folder";

    fn write_os_config_file(os_config_directory: &Path) -> std::io::Result<PathBuf> {
        let os_config_file = os_config_directory
            .join(OS_CONFIG_SUBDIRECTORY)
            .join(CONFIG_FILE_NAME);
        fs::create_dir(os_config_directory.join(OS_CONFIG_SUBDIRECTORY))?;
        fs::write(&os_config_file, "")?;
        Ok(os_config_file)
    }

    #[test]
    fn an_explicit_path_wins_even_when_missing() {
        let located = locate_config_file(
            Some(Path::new("custom.toml")),
            Path::new("."),
            None,
            Path::new(MISSING_FOLDER),
        );

        assert_eq!(located, Some(PathBuf::from("custom.toml")));
    }

    #[test]
    fn prefers_the_current_directory_over_the_os_config_folder() -> std::io::Result<()> {
        let current_directory = tempfile::tempdir()?;
        let os_config_directory = tempfile::tempdir()?;
        fs::write(current_directory.path().join(CONFIG_FILE_NAME), "")?;
        write_os_config_file(os_config_directory.path())?;

        let located = locate_config_file(
            None,
            current_directory.path(),
            Some(os_config_directory.path()),
            Path::new(MISSING_FOLDER),
        );

        assert_eq!(
            located,
            Some(current_directory.path().join(CONFIG_FILE_NAME))
        );
        Ok(())
    }

    #[test]
    fn falls_back_to_the_os_config_folder() -> std::io::Result<()> {
        let current_directory = tempfile::tempdir()?;
        let os_config_directory = tempfile::tempdir()?;
        let os_config_file = write_os_config_file(os_config_directory.path())?;

        let located = locate_config_file(
            None,
            current_directory.path(),
            Some(os_config_directory.path()),
            Path::new(MISSING_FOLDER),
        );

        assert_eq!(located, Some(os_config_file));
        Ok(())
    }

    #[test]
    fn falls_back_to_the_container_config_folder() -> std::io::Result<()> {
        let current_directory = tempfile::tempdir()?;
        let container_config_directory = tempfile::tempdir()?;
        fs::write(container_config_directory.path().join(CONFIG_FILE_NAME), "")?;

        let located = locate_config_file(
            None,
            current_directory.path(),
            None,
            container_config_directory.path(),
        );

        assert_eq!(
            located,
            Some(container_config_directory.path().join(CONFIG_FILE_NAME))
        );
        Ok(())
    }

    #[test]
    fn finds_nothing_when_no_file_exists() -> std::io::Result<()> {
        let current_directory = tempfile::tempdir()?;

        let located = locate_config_file(
            None,
            current_directory.path(),
            None,
            Path::new(MISSING_FOLDER),
        );

        assert_eq!(located, None);
        Ok(())
    }
}
