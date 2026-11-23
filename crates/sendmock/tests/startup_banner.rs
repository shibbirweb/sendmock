#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::time::Duration;

use support::sendmock_process::{READY_MESSAGE, SendmockProcess, sendmock_command};

const QUIET_PERIOD: Duration = Duration::from_millis(300);

fn is_braille(character: char) -> bool {
    ('\u{2800}'..='\u{28ff}').contains(&character)
}

fn has_banner_line(printed_lines: &[String]) -> bool {
    printed_lines
        .iter()
        .any(|line| line.chars().any(is_braille) || line.starts_with("SendMock v"))
}

// AC: PL-23.4
#[test]
fn piped_output_starts_with_the_log_lines_and_no_banner() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let sendmock = SendmockProcess::start(sendmock_command(working_directory.path()).args([
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
    ]))
    .expect("sendmock starts");

    sendmock.wait_for_line(READY_MESSAGE);
    let printed_lines = sendmock.read_printed_lines(QUIET_PERIOD);

    assert!(!has_banner_line(&printed_lines), "{printed_lines:?}");
    // A human log line starts with its timestamp, as every start printed before the banner.
    assert!(
        printed_lines
            .first()
            .and_then(|line| line.chars().next())
            .is_some_and(|first_character| first_character.is_ascii_digit()),
        "{printed_lines:?}"
    );
}

// AC: PL-23.4
#[test]
fn ready_json_keeps_its_json_line_first_on_stdout() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let sendmock = SendmockProcess::start(sendmock_command(working_directory.path()).args([
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
        "--ready-json",
    ]))
    .expect("sendmock starts");

    sendmock.wait_for_line("http_addr");
    let printed_lines = sendmock.read_printed_lines(QUIET_PERIOD);
    let first_line: serde_json::Value =
        serde_json::from_str(printed_lines.first().map_or("", String::as_str)).unwrap_or_default();

    assert!(!has_banner_line(&printed_lines), "{printed_lines:?}");
    assert!(first_line["http_addr"].is_string(), "{printed_lines:?}");
}
