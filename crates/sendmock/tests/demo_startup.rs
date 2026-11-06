#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::io;
use std::path::Path;

use serde_json::Value;
use support::http_get::send_http_get;
use support::sendmock_process::{SendmockProcess, sendmock_command};

fn start_demo_server(working_directory: &Path) -> io::Result<SendmockProcess> {
    SendmockProcess::start(sendmock_command(working_directory).args([
        "--demo",
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "demo.db",
        "--log-format",
        "json",
    ]))
}

fn read_total_count(http_addr: &str, path: &str) -> io::Result<u64> {
    let raw_response = send_http_get(http_addr, path)?;
    let body = raw_response
        .split_once("\r\n\r\n")
        .map_or("", |(_, body)| body);
    let page: Value = serde_json::from_str(body).map_err(io::Error::other)?;
    Ok(page["total_count"].as_u64().unwrap_or_default())
}

// AC: PL-09.1 PL-09.3
#[test]
fn demo_fills_a_fresh_instance_once_and_leaves_one_with_data_alone() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let first_run = start_demo_server(working_directory.path())?;
    let loaded_line = first_run.wait_for_line("Loaded the demo data");
    let first_http_addr = first_run.wait_for_http_addr();
    let first_email_count = read_total_count(&first_http_addr, "/api/v1/emails")?;
    let first_payment_count = read_total_count(&first_http_addr, "/api/v1/payments")?;
    drop(first_run);

    let second_run = start_demo_server(working_directory.path())?;
    let skipped_line = second_run.wait_for_line("Skipped the demo data");
    let second_http_addr = second_run.wait_for_http_addr();
    let second_email_count = read_total_count(&second_http_addr, "/api/v1/emails")?;

    assert!(loaded_line.contains("step_count"), "{loaded_line}");
    assert!(first_email_count > 10, "{first_email_count}");
    assert_eq!(first_payment_count, 5);
    assert!(
        skipped_line.contains("already holds data"),
        "{skipped_line}"
    );
    assert_eq!(second_email_count, first_email_count);
    Ok(())
}
