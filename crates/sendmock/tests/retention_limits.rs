#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::fs;
use std::io;
use std::path::Path;
use std::time::Duration;

use support::http_get::send_http_get;
use support::sendmock_process::{READY_MESSAGE, SendmockProcess, sendmock_command};

const FREE_PORT_ARGUMENTS: [&str; 6] = [
    "--http-addr",
    "127.0.0.1:0",
    "--db",
    "memory",
    "--log-format",
    "json",
];
const UNBOUNDED_WARNING: &str = "no retention limit for";

fn read_stored_settings(http_addr: &str) -> io::Result<String> {
    send_http_get(http_addr, "/api/v1/settings")
}

fn write_config_file(working_directory: &Path, config_text: &str) -> io::Result<()> {
    fs::write(working_directory.join("sendmock.toml"), config_text)
}

// AC: PL-08.3
#[test]
fn the_environment_variable_sets_the_sms_limit_over_the_config_file() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    write_config_file(working_directory.path(), "max_sms = 300\n").expect("config file is written");

    let sendmock = SendmockProcess::start(
        sendmock_command(working_directory.path())
            .args(FREE_PORT_ARGUMENTS)
            .env("SENDMOCK_MAX_SMS", "25"),
    )
    .expect("sendmock starts");

    assert!(
        read_stored_settings(&sendmock.wait_for_http_addr())
            .expect("settings answer")
            .contains("\"max_sms\":25")
    );
}

// AC: PL-08.3
#[test]
fn the_flag_sets_the_sms_limit_over_the_environment_variable() {
    let working_directory = tempfile::tempdir().expect("temporary folder");

    let sendmock = SendmockProcess::start(
        sendmock_command(working_directory.path())
            .args(FREE_PORT_ARGUMENTS)
            .args(["--max-sms", "40"])
            .env("SENDMOCK_MAX_SMS", "25"),
    )
    .expect("sendmock starts");

    assert!(
        read_stored_settings(&sendmock.wait_for_http_addr())
            .expect("settings answer")
            .contains("\"max_sms\":40")
    );
}

// AC: PL-08.4
#[test]
fn a_limit_of_zero_without_an_age_limit_warns_at_startup() {
    let working_directory = tempfile::tempdir().expect("temporary folder");

    let sendmock = SendmockProcess::start(
        sendmock_command(working_directory.path())
            .args(FREE_PORT_ARGUMENTS)
            .args(["--max-emails", "0"]),
    )
    .expect("sendmock starts");

    let http_addr = sendmock.wait_for_http_addr();

    let printed_lines = sendmock.read_printed_lines(Duration::from_millis(500));
    assert!(
        printed_lines.iter().any(|printed_line| {
            printed_line.contains(UNBOUNDED_WARNING) && printed_line.contains("emails")
        }),
        "{printed_lines:?}"
    );
    assert!(
        read_stored_settings(&http_addr)
            .expect("settings answer")
            .contains("\"max_emails\":0")
    );
}

// AC: PL-08.4
#[test]
fn a_limit_of_zero_with_an_age_limit_does_not_warn() {
    let working_directory = tempfile::tempdir().expect("temporary folder");

    let sendmock = SendmockProcess::start(
        sendmock_command(working_directory.path())
            .args(FREE_PORT_ARGUMENTS)
            .args(["--max-emails", "0", "--max-age", "7d"]),
    )
    .expect("sendmock starts");
    sendmock.wait_for_line(READY_MESSAGE);

    let printed_lines = sendmock.read_printed_lines(Duration::from_millis(500));
    assert!(
        printed_lines
            .iter()
            .all(|printed_line| !printed_line.contains(UNBOUNDED_WARNING)),
        "{printed_lines:?}"
    );
}
