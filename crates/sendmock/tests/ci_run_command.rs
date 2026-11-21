#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod sendmock_process;
}

use std::io::{self, BufRead, BufReader, Read, Write};
use std::net::TcpListener;
use std::path::Path;
use std::thread;

use support::sendmock_process::{run_until_exit, sendmock_command};

/// A stand-in for the app under test: answers every webhook with this status.
fn start_app(response_status: u16) -> io::Result<String> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let app_url = format!("http://{}", listener.local_addr()?);
    thread::spawn(move || {
        for mut connection in listener.incoming().map_while(Result::ok) {
            let mut reader = BufReader::new(match connection.try_clone() {
                Ok(reading_half) => reading_half,
                Err(_) => continue,
            });
            let mut content_length = 0_usize;
            let mut header_line = String::new();
            while reader
                .read_line(&mut header_line)
                .is_ok_and(|read| read > 2)
            {
                if let Some(length) = header_line
                    .to_ascii_lowercase()
                    .strip_prefix("content-length:")
                {
                    content_length = length.trim().parse().unwrap_or_default();
                }
                header_line.clear();
            }
            let mut body = vec![0_u8; content_length];
            let _ = reader.read_exact(&mut body);
            let _ = write!(
                connection,
                "HTTP/1.1 {response_status} Status\r\ncontent-length: 2\r\nconnection: close\r\n\r\nok"
            );
        }
    });
    Ok(app_url)
}

fn write_ci_files(working_directory: &Path, app_url: &str) -> io::Result<()> {
    std::fs::write(
        working_directory.join("sendmock.setup.yml"),
        format!(
            "sendmock:\n  format: sendmock.setup\n  format_version: 2\nwebhook:\n  endpoints:\n    - name: Shop app\n      url: {app_url}/webhooks/sendmock\n      retry_policy: {{ max_attempts: 1, backoff_seconds: [1], retry_on_client_errors: false }}\n"
        ),
    )?;
    std::fs::write(
        working_directory.join("sendmock.ci.yml"),
        format!(
            "sendmock:\n  format: sendmock.ci\n  format_version: 1\nsetup: sendmock.setup.yml\napp_url: {app_url}\nscenarios:\n  - name: the shop accepts a signed webhook\n    steps:\n      - run: webhook.endpoint.test\n        with: {{ endpoint_id: Shop app }}\n      - run: webhook.delivery.wait\n        with: {{ endpoint: Shop app, status: succeeded, timeout: 3s }}\n        save: delivery\n      - run: assert\n        with: {{ that: \"{{{{ delivery.response.status_code }}}} == 200\" }}\nreport:\n  json: reports/sendmock-report.json\n"
        ),
    )
}

// AC: WH-15.2
// AC: WH-15.3
// AC: WH-15.4
#[test]
fn ci_run_starts_its_own_sendmock_passes_and_writes_the_reports() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    write_ci_files(working_directory.path(), &start_app(200)?)?;
    let summary_path = working_directory.path().join("step-summary.md");

    let output = run_until_exit(
        sendmock_command(working_directory.path())
            .env("GITHUB_STEP_SUMMARY", &summary_path)
            .args([
                "ci",
                "run",
                "sendmock.ci.yml",
                "--junit",
                "sendmock-report.xml",
            ]),
    )?;

    let printed = String::from_utf8_lossy(&output.stdout);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{printed}{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        printed.contains("passed  the shop accepts a signed webhook"),
        "{printed}"
    );
    let junit_xml = std::fs::read_to_string(working_directory.path().join("sendmock-report.xml"))?;
    assert!(
        junit_xml.contains(
            "<testsuite name=\"the shop accepts a signed webhook\" tests=\"3\" failures=\"0\""
        ),
        "{junit_xml}"
    );
    let json_report = std::fs::read_to_string(
        working_directory
            .path()
            .join("reports")
            .join("sendmock-report.json"),
    )?;
    assert!(json_report.contains("\"is_passed\":true"), "{json_report}");
    let summary = std::fs::read_to_string(&summary_path)?;
    assert!(
        summary.starts_with("## SendMock: 1 of 1 scenarios passed"),
        "{summary}"
    );
    Ok(())
}

// AC: WH-15.2
// AC: WH-15.4
#[test]
fn a_broken_app_fails_the_run_with_exit_code_five_and_an_invalid_file_with_two() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    write_ci_files(working_directory.path(), &start_app(500)?)?;
    std::fs::write(
        working_directory.path().join("broken.ci.yml"),
        "scenarios: []\n",
    )?;

    let failed = run_until_exit(sendmock_command(working_directory.path()).args([
        "ci",
        "run",
        "sendmock.ci.yml",
        "--junit",
        "report.xml",
    ]))?;
    let invalid = run_until_exit(sendmock_command(working_directory.path()).args([
        "ci",
        "run",
        "broken.ci.yml",
    ]))?;

    assert_eq!(
        failed.status.code(),
        Some(5),
        "{}",
        String::from_utf8_lossy(&failed.stdout)
    );
    let printed = String::from_utf8_lossy(&failed.stdout);
    assert!(
        printed
            .contains("failed  the shop accepts a signed webhook: step 2 (webhook.delivery.wait)"),
        "{printed}"
    );
    let junit_xml = std::fs::read_to_string(working_directory.path().join("report.xml"))?;
    assert!(junit_xml.contains("<failure message="), "{junit_xml}");
    assert_eq!(
        invalid.status.code(),
        Some(2),
        "{}",
        String::from_utf8_lossy(&invalid.stderr)
    );
    Ok(())
}
