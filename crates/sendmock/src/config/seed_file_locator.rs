use std::path::{Path, PathBuf};

pub const SEED_FILE_NAME: &str = "sendmock.seed.toml";
/// Where the Docker image looks for mounted configuration.
pub const CONTAINER_CONFIG_DIRECTORY: &str = "/config";

/// The seed file to load: the one named by `--seed`, else `./sendmock.seed.toml`, else
/// `/config/sendmock.seed.toml`; `None` when there is none.
pub fn locate_seed_file(
    explicit_file_path: Option<&Path>,
    current_directory: &Path,
    container_config_directory: &Path,
) -> Option<PathBuf> {
    if let Some(explicit_file_path) = explicit_file_path {
        return Some(explicit_file_path.to_path_buf());
    }
    [current_directory, container_config_directory]
        .into_iter()
        .map(|directory| directory.join(SEED_FILE_NAME))
        .find(|seed_file_path| seed_file_path.is_file())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn an_explicit_path_wins() {
        let located = locate_seed_file(
            Some(Path::new("custom.seed.toml")),
            Path::new("."),
            Path::new("/config"),
        );

        assert_eq!(located, Some(PathBuf::from("custom.seed.toml")));
    }

    #[test]
    fn prefers_the_current_directory_over_the_container_folder() -> std::io::Result<()> {
        let current_directory = tempfile::tempdir()?;
        let container_config_directory = tempfile::tempdir()?;
        fs::write(current_directory.path().join(SEED_FILE_NAME), "")?;
        fs::write(container_config_directory.path().join(SEED_FILE_NAME), "")?;

        let located = locate_seed_file(
            None,
            current_directory.path(),
            container_config_directory.path(),
        );

        assert_eq!(located, Some(current_directory.path().join(SEED_FILE_NAME)));
        Ok(())
    }

    #[test]
    fn falls_back_to_the_container_folder() -> std::io::Result<()> {
        let current_directory = tempfile::tempdir()?;
        let container_config_directory = tempfile::tempdir()?;
        fs::write(container_config_directory.path().join(SEED_FILE_NAME), "")?;

        let located = locate_seed_file(
            None,
            current_directory.path(),
            container_config_directory.path(),
        );

        assert_eq!(
            located,
            Some(container_config_directory.path().join(SEED_FILE_NAME))
        );
        Ok(())
    }

    #[test]
    fn finds_nothing_when_no_seed_file_exists() -> std::io::Result<()> {
        let current_directory = tempfile::tempdir()?;
        let container_config_directory = tempfile::tempdir()?;

        assert_eq!(
            locate_seed_file(
                None,
                current_directory.path(),
                container_config_directory.path()
            ),
            None
        );
        Ok(())
    }
}
