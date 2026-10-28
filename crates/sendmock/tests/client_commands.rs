#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod sendmock_process;
}

use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

fn start_server(working_directory: &std::path::Path) -> (SendmockProcess, String) {
    let sendmock = SendmockProcess::start_with_free_port(working_directory)
        .unwrap_or_else(|start_error| panic!("sendmock starts: {start_error}"));
    let server_url = format!("http://{}", sendmock.wait_for_http_addr());
    (sendmock, server_url)
}

// AC: AI-01.2
#[test]
fn status_prints_json_when_the_output_is_not_a_terminal() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, server_url) = start_server(working_directory.path());

    let output = run_until_exit(sendmock_command(working_directory.path()).args([
        "status",
        "--server",
        &server_url,
    ]))
    .expect("the command runs");

    let app_info: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout is JSON");
    assert_eq!(output.status.code(), Some(0));
    assert_eq!(app_info["database_path"], "memory");
    assert_eq!(app_info["channel"], "dev");
}

// AC: AI-01.3
#[test]
fn health_exits_zero_while_the_server_runs() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, server_url) = start_server(working_directory.path());

    let output = run_until_exit(sendmock_command(working_directory.path()).args([
        "health",
        "--server",
        &server_url,
    ]))
    .expect("the command runs");

    assert_eq!(output.status.code(), Some(0));
}

// AC: AI-01.3
#[test]
fn a_server_that_is_not_running_is_an_error() {
    let working_directory = tempfile::tempdir().expect("temporary folder");

    let output = run_until_exit(sendmock_command(working_directory.path()).args([
        "health",
        "--server",
        "http://127.0.0.1:9",
    ]))
    .expect("the command runs");

    assert_eq!(output.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&output.stderr).contains("Could not reach SendMock"));
}

// AC: AI-01.3
#[test]
fn an_unknown_command_is_a_usage_error() {
    let working_directory = tempfile::tempdir().expect("temporary folder");

    let output = run_until_exit(sendmock_command(working_directory.path()).arg("frobnicate"))
        .expect("the command runs");

    assert_eq!(output.status.code(), Some(2));
}

// AC: AI-01.5
#[test]
fn help_all_json_lists_the_command_tree_and_the_mcp_tools() {
    let working_directory = tempfile::tempdir().expect("temporary folder");

    let output = run_until_exit(
        sendmock_command(working_directory.path()).args(["help", "--all", "--json"]),
    )
    .expect("the command runs");

    let command_tree: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout is JSON");
    let command_names: Vec<&str> = command_tree["commands"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|command| command["command"].as_str())
        .collect();
    assert_eq!(output.status.code(), Some(0));
    assert!(command_names.contains(&"sendmock serve"));
    assert!(command_names.contains(&"sendmock status"));
    assert!(command_names.contains(&"sendmock health"));
    assert_eq!(command_tree["mcp_tools"][0]["name"], "sendmock_status");
}

#[test]
fn version_answers_without_a_server() {
    let working_directory = tempfile::tempdir().expect("temporary folder");

    let output =
        run_until_exit(sendmock_command(working_directory.path()).args(["version", "--json"]))
            .expect("the command runs");

    let version: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout is JSON");
    assert_eq!(version["version"], env!("CARGO_PKG_VERSION"));
    assert_eq!(version["channel"], "dev");
}
