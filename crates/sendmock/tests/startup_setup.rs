#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::io::{self, Read, Write};
use std::net::TcpListener;
use std::thread;

use serde_json::Value;
use support::http_get::send_http_get;
use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

const SETUP_YAML: &str = "sendmock:\n  format: sendmock.setup\n  format_version: 2\nnumbers:\n  - number: \"+15550001111\"\n    label: Support line\n";

/// Serves one setup file over plain HTTP on loopback, which setup downloads allow.
fn serve_setup_once(setup_text: &'static str) -> io::Result<String> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let setup_url = format!("http://{}/sendmock.setup.yml", listener.local_addr()?);
    thread::spawn(move || {
        if let Ok((mut connection, _)) = listener.accept() {
            let mut request_start = [0_u8; 1024];
            let _ = connection.read(&mut request_start);
            let _ = write!(
                connection,
                "HTTP/1.1 200 OK\r\ncontent-type: application/yaml\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{setup_text}",
                setup_text.len()
            );
        }
    });
    Ok(setup_url)
}

fn read_numbers(http_addr: &str) -> io::Result<String> {
    let raw_response = send_http_get(http_addr, "/api/v1/numbers")?;
    Ok(raw_response
        .split_once("\r\n\r\n")
        .map(|(_, body)| body.to_owned())
        .unwrap_or_default())
}

fn start_with_setup(
    setup_location: &str,
    working_directory: &std::path::Path,
) -> io::Result<SendmockProcess> {
    SendmockProcess::start(sendmock_command(working_directory).args([
        "--setup",
        setup_location,
        "--ready-json",
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
    ]))
}

// AC: WH-15.1
#[test]
fn a_setup_file_is_applied_before_sendmock_reports_ready() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let setup_path = working_directory.path().join("sendmock.setup.yml");
    std::fs::write(&setup_path, SETUP_YAML)?;

    let server = start_with_setup(&setup_path.display().to_string(), working_directory.path())?;
    let ready_fields: Value =
        serde_json::from_str(&server.wait_for_line("http_addr")).map_err(io::Error::other)?;

    let numbers = read_numbers(ready_fields["http_addr"].as_str().unwrap_or_default())?;
    assert!(numbers.contains("+15550001111"), "{numbers}");
    Ok(())
}

// AC: WH-15.1
#[test]
fn a_setup_url_is_downloaded_and_applied_at_startup() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let setup_url = serve_setup_once(SETUP_YAML)?;

    let server = start_with_setup(&setup_url, working_directory.path())?;
    let ready_fields: Value =
        serde_json::from_str(&server.wait_for_line("http_addr")).map_err(io::Error::other)?;

    let numbers = read_numbers(ready_fields["http_addr"].as_str().unwrap_or_default())?;
    assert!(numbers.contains("Support line"), "{numbers}");
    Ok(())
}

// AC: WH-15.1
#[test]
fn a_setup_that_does_not_validate_stops_startup_with_the_reason() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let setup_path = working_directory.path().join("broken.setup.yml");
    std::fs::write(
        &setup_path,
        "sendmock:\n  format: sendmock.setup\n  format_version: 2\nnumbers:\n  - number: \"+15550001111\"\n    labl: typo\n",
    )?;

    let output = run_until_exit(sendmock_command(working_directory.path()).args([
        "--setup",
        &setup_path.display().to_string(),
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
    ]))?;

    assert_eq!(output.status.code(), Some(2));
    let startup_output = String::from_utf8_lossy(&output.stderr);
    assert!(
        startup_output.contains("could not be applied"),
        "{startup_output}"
    );
    assert!(startup_output.contains("labl"), "{startup_output}");
    Ok(())
}
