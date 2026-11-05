#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod sendmock_process;
}

use std::path::{Path, PathBuf};

use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

fn start_server(working_directory: &Path) -> (SendmockProcess, String) {
    let sendmock = SendmockProcess::start_with_free_port(working_directory)
        .unwrap_or_else(|start_error| panic!("sendmock starts: {start_error}"));
    let server_url = format!("http://{}", sendmock.wait_for_http_addr());
    (sendmock, server_url)
}

fn skill_examples_directory() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../skill/sendmock/examples")
}

// AC: AI-05.1
#[test]
fn ai_skill_prints_the_skill_for_this_version() {
    let working_directory = tempfile::tempdir()
        .unwrap_or_else(|folder_error| panic!("temporary folder: {folder_error}"));
    let (_sendmock, server_url) = start_server(working_directory.path());

    let output = run_until_exit(sendmock_command(working_directory.path()).args([
        "ai",
        "skill",
        "--server",
        &server_url,
    ]))
    .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"));

    let skill_markdown = String::from_utf8_lossy(&output.stdout);
    assert_eq!(output.status.code(), Some(0), "{skill_markdown}");
    assert!(
        skill_markdown.starts_with("---\nname: sendmock\n"),
        "{skill_markdown}"
    );
    assert!(skill_markdown.contains(&format!(
        "Written for SendMock {}.",
        env!("CARGO_PKG_VERSION")
    )));
}

// AC: AI-04.3
#[test]
fn the_skills_example_scenarios_pass_against_the_binary() {
    let working_directory = tempfile::tempdir()
        .unwrap_or_else(|folder_error| panic!("temporary folder: {folder_error}"));
    let (_sendmock, server_url) = start_server(working_directory.path());
    let mut example_paths: Vec<PathBuf> = std::fs::read_dir(skill_examples_directory())
        .unwrap_or_else(|read_error| panic!("the skill's examples: {read_error}"))
        .filter_map(|directory_entry| {
            directory_entry
                .ok()
                .map(|directory_entry| directory_entry.path())
        })
        .collect();
    example_paths.sort();

    assert_eq!(example_paths.len(), 3, "{example_paths:?}");
    for example_path in example_paths {
        let output = run_until_exit(
            sendmock_command(working_directory.path())
                .args(["scenario", "run"])
                .arg(&example_path)
                .args(["--server", &server_url]),
        )
        .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"));
        let scenario_report = String::from_utf8_lossy(&output.stdout);
        assert_eq!(
            output.status.code(),
            Some(0),
            "{}: {scenario_report}",
            example_path.display()
        );
    }
}
