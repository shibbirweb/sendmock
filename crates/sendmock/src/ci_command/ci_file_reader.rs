//! Reads a CI file from a path or URL and inlines the setup and scenario files it names by
//! path, relative to the CI file, so the server needs no access to the repository.

use std::path::{Path, PathBuf};
use std::time::Duration;

use sendmock_cli::CliError;
use serde_json::{Value, json};

/// The setup download's limits: 1 MB and 10 seconds.
const LARGEST_DOWNLOAD_BYTES: usize = 1024 * 1024;
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(10);

pub fn is_url(location: &str) -> bool {
    location.starts_with("https://") || location.starts_with("http://")
}

async fn download_text(url: &str) -> Result<String, CliError> {
    let unreadable = |reason: String| CliError::UnreadableFile {
        file_path: url.to_owned(),
        reason,
    };
    let client = reqwest::Client::builder()
        .timeout(DOWNLOAD_TIMEOUT)
        .build()
        .map_err(|build_error| unreadable(build_error.to_string()))?;
    let response = client
        .get(url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|download_error| unreadable(download_error.to_string()))?;
    let body = response
        .bytes()
        .await
        .map_err(|read_error| unreadable(read_error.to_string()))?;
    if body.len() > LARGEST_DOWNLOAD_BYTES {
        return Err(unreadable("it is larger than 1 MB".to_owned()));
    }
    Ok(String::from_utf8_lossy(&body).into_owned())
}

fn read_local_file(file_path: &Path) -> Result<String, CliError> {
    std::fs::read_to_string(file_path).map_err(|read_error| CliError::UnreadableFile {
        file_path: file_path.display().to_string(),
        reason: read_error.to_string(),
    })
}

/// The CI file's text, and the folder its relative paths start from.
pub async fn read_ci_source(location: &str) -> Result<(String, PathBuf), CliError> {
    if is_url(location) {
        let current_directory = std::env::current_dir().unwrap_or_default();
        return Ok((download_text(location).await?, current_directory));
    }
    let ci_path = Path::new(location);
    let base_directory = ci_path.parent().map(Path::to_path_buf).unwrap_or_default();
    Ok((read_local_file(ci_path)?, base_directory))
}

fn read_format_name(file_path: &str) -> Option<&'static str> {
    let lowercase_path = file_path.to_ascii_lowercase();
    [
        ("toml", "toml"),
        ("json", "json"),
        ("yml", "yaml"),
        ("yaml", "yaml"),
    ]
    .into_iter()
    .find(|(extension, _)| lowercase_path.ends_with(&format!(".{extension}")))
    .map(|(_, format_name)| format_name)
}

/// The CI file as JSON, with `setup: <path>` and `{ file: <path> }` scenarios replaced by
/// their text; URLs stay for the server to download.
pub fn inline_ci_paths(ci_text: &str, base_directory: &Path) -> Result<String, CliError> {
    let mut ci_document: Value = serde_yaml_ng::from_str(ci_text).map_err(|parse_error| {
        CliError::InvalidInput(format!(
            "The CI file is not valid JSON or YAML: {parse_error}"
        ))
    })?;
    if let Some(setup_path) = ci_document["setup"]
        .as_str()
        .filter(|setup| !is_url(setup))
        .map(str::to_owned)
    {
        let setup_text = read_local_file(&base_directory.join(&setup_path))?;
        ci_document["setup"] =
            json!({ "text": setup_text, "format": read_format_name(&setup_path) });
    }
    if let Some(scenarios) = ci_document["scenarios"].as_array_mut() {
        for scenario in scenarios.iter_mut() {
            if let Some(scenario_path) = scenario["file"].as_str().map(str::to_owned) {
                let scenario_text = read_local_file(&base_directory.join(&scenario_path))?;
                *scenario = json!({ "name": scenario_path, "text": scenario_text });
            }
        }
    }
    Ok(ci_document.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: WH-15.2
    #[test]
    fn setup_and_scenario_paths_are_read_relative_to_the_ci_file() -> std::io::Result<()> {
        let working_directory = tempfile::tempdir()?;
        std::fs::write(
            working_directory.path().join("sendmock.setup.yml"),
            "numbers: []\n",
        )?;
        std::fs::create_dir(working_directory.path().join("scenarios"))?;
        std::fs::write(
            working_directory
                .path()
                .join("scenarios")
                .join("refund.toml"),
            "name = \"refund\"\n[[steps]]\nrun = \"assert\"\n",
        )?;
        let ci_text = "sendmock: { format: sendmock.ci, format_version: 1 }\nsetup: sendmock.setup.yml\nscenarios:\n  - file: scenarios/refund.toml\n  - url: https://example.test/a.yml\n";

        let inlined = inline_ci_paths(ci_text, working_directory.path())
            .map_err(|cli_error| std::io::Error::other(cli_error.to_string()))?;

        let inlined_document: Value =
            serde_json::from_str(&inlined).map_err(std::io::Error::other)?;
        assert_eq!(inlined_document["setup"]["text"], "numbers: []\n");
        assert_eq!(inlined_document["setup"]["format"], "yaml");
        assert_eq!(
            inlined_document["scenarios"][0]["name"],
            "scenarios/refund.toml"
        );
        assert!(
            inlined_document["scenarios"][0]["text"]
                .as_str()
                .is_some_and(|text| text.contains("refund"))
        );
        assert_eq!(
            inlined_document["scenarios"][1]["url"],
            "https://example.test/a.yml"
        );
        Ok(())
    }
}
