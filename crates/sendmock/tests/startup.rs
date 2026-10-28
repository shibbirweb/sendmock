mod support {
    pub mod sendmock_process;
}

use std::fs;
use std::net::TcpListener;

use support::sendmock_process::{READY_MESSAGE, SendmockProcess, run_until_exit, sendmock_command};

const FREE_PORT_ARGUMENTS: [&str; 4] = ["--http-addr", "127.0.0.1:0", "--db", "memory"];

fn is_json_line(log_line: &str) -> bool {
    log_line.trim_start().starts_with('{')
}

// AC: PL-07.1
#[test]
fn the_config_file_applies_when_nothing_overrides_it() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    fs::write(
        working_directory.path().join("sendmock.toml"),
        "log_format = \"json\"\n",
    )
    .expect("config file is written");

    let sendmock = SendmockProcess::start(
        sendmock_command(working_directory.path()).args(FREE_PORT_ARGUMENTS),
    )
    .expect("sendmock starts");

    assert!(is_json_line(&sendmock.wait_for_line(READY_MESSAGE)));
}

// AC: PL-07.1
#[test]
fn an_environment_variable_wins_over_the_config_file() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    fs::write(
        working_directory.path().join("sendmock.toml"),
        "log_format = \"json\"\n",
    )
    .expect("config file is written");

    let sendmock = SendmockProcess::start(
        sendmock_command(working_directory.path())
            .args(FREE_PORT_ARGUMENTS)
            .env("SENDMOCK_LOG_FORMAT", "human"),
    )
    .expect("sendmock starts");

    assert!(!is_json_line(&sendmock.wait_for_line(READY_MESSAGE)));
}

// AC: PL-07.1
#[test]
fn a_flag_wins_over_the_environment_variable() {
    let working_directory = tempfile::tempdir().expect("temporary folder");

    let sendmock = SendmockProcess::start(
        sendmock_command(working_directory.path())
            .args(FREE_PORT_ARGUMENTS)
            .args(["--log-format", "json"])
            .env("SENDMOCK_LOG_FORMAT", "human"),
    )
    .expect("sendmock starts");

    assert!(is_json_line(&sendmock.wait_for_line(READY_MESSAGE)));
}

// AC: PL-07.2
#[test]
fn an_unknown_config_key_stops_startup_with_a_usage_error() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    fs::write(
        working_directory.path().join("sendmock.toml"),
        "colour = \"blue\"\n",
    )
    .expect("config file is written");

    let output =
        run_until_exit(sendmock_command(working_directory.path()).args(FREE_PORT_ARGUMENTS))
            .expect("sendmock runs");

    let error_output = String::from_utf8_lossy(&output.stderr);
    assert_eq!(output.status.code(), Some(2));
    assert!(error_output.contains("sendmock.toml"));
    assert!(error_output.contains("colour"));
}

// AC: PL-07.2
#[test]
fn an_invalid_flag_value_stops_startup_with_a_usage_error() {
    let working_directory = tempfile::tempdir().expect("temporary folder");

    let output =
        run_until_exit(sendmock_command(working_directory.path()).args(["--log-format", "loud"]))
            .expect("sendmock runs");

    assert_eq!(output.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&output.stderr).contains("loud"));
}

// AC: PL-07.3
#[test]
fn a_busy_port_stops_startup_and_suggests_the_flag() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let busy_listener = TcpListener::bind("127.0.0.1:0").expect("a free port");
    let busy_address = busy_listener
        .local_addr()
        .expect("bound address")
        .to_string();

    let output = run_until_exit(sendmock_command(working_directory.path()).args([
        "--http-addr",
        &busy_address,
        "--db",
        "memory",
    ]))
    .expect("sendmock runs");

    let error_output = String::from_utf8_lossy(&output.stderr);
    assert_eq!(output.status.code(), Some(1));
    assert!(error_output.contains("is in use"));
    assert!(error_output.contains("--http-addr"));
}

#[test]
fn refuses_a_database_from_a_newer_version() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let database_file_path = working_directory.path().join("sendmock.db");
    rusqlite::Connection::open(&database_file_path)
        .and_then(|connection| connection.pragma_update(None, "user_version", 99))
        .expect("a database from a newer version");

    let output = run_until_exit(sendmock_command(working_directory.path()).args([
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "sendmock.db",
    ]))
    .expect("sendmock runs");

    assert_eq!(output.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&output.stderr).contains("newer SendMock"));
}

#[cfg(unix)]
#[test]
fn stops_cleanly_on_sigterm() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let sendmock = SendmockProcess::start(
        sendmock_command(working_directory.path()).args(FREE_PORT_ARGUMENTS),
    )
    .expect("sendmock starts");
    sendmock.wait_for_line(READY_MESSAGE);

    let kill_status = std::process::Command::new("kill")
        .args(["-TERM", &sendmock.process_id().to_string()])
        .status()
        .expect("kill runs");

    assert!(kill_status.success());
    assert!(sendmock.wait_for_exit_success());
}
