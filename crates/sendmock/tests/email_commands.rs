#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::path::Path;
use std::process::Output;

use support::http_get::send_http_get;
use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

const ONE_PIXEL_PNG_BASE64: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

fn start_server(working_directory: &Path) -> (SendmockProcess, String) {
    let sendmock = SendmockProcess::start_with_free_port(working_directory)
        .unwrap_or_else(|start_error| panic!("sendmock starts: {start_error}"));
    let http_addr = sendmock.wait_for_http_addr();
    (sendmock, http_addr)
}

fn run_command(working_directory: &Path, http_addr: &str, arguments: &[&str]) -> Output {
    let server_url = format!("http://{http_addr}");
    run_until_exit(
        sendmock_command(working_directory)
            .args(arguments)
            .args(["--server", &server_url]),
    )
    .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"))
}

fn stdout_json(output: &Output) -> serde_json::Value {
    serde_json::from_slice(&output.stdout).unwrap_or_else(|parse_error| {
        panic!(
            "stdout is JSON ({parse_error}): {}",
            String::from_utf8_lossy(&output.stdout)
        )
    })
}

fn send_code_email(working_directory: &Path, http_addr: &str) -> String {
    let attachment = format!(r#"[{{"filename":"logo.png","content":"{ONE_PIXEL_PNG_BASE64}"}}]"#);
    let output = run_command(
        working_directory,
        http_addr,
        &[
            "email",
            "send",
            "--from",
            "Shop <no-reply@shop.test>",
            "--to",
            "sam@example.test",
            "--subject",
            "Your code",
            "--text",
            "Your verification code is 482913. https://shop.test/confirm",
            "--attachments",
            &attachment,
        ],
    );
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    stdout_json(&output)["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

// AC: EM-05.4
// AC: EM-07.3
#[test]
fn a_sent_email_gives_its_code_and_links_to_the_cli_and_shows_its_source() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, http_addr) = start_server(working_directory.path());
    let email_id = send_code_email(working_directory.path(), &http_addr);

    let otp = stdout_json(&run_command(
        working_directory.path(),
        &http_addr,
        &["otp", "--to", "sam@example.test"],
    ));
    let links = stdout_json(&run_command(
        working_directory.path(),
        &http_addr,
        &["links", "--to", "sam@example.test"],
    ));
    let email = stdout_json(&run_command(
        working_directory.path(),
        &http_addr,
        &["email", "show", &email_id],
    ));

    assert_eq!(otp["code"], "482913");
    assert_eq!(otp["source_id"], email_id.as_str());
    assert_eq!(links["links"][0], "https://shop.test/confirm");
    assert_eq!(email["source"], "native_api");
}

// AC: EM-04.5
#[test]
fn an_attachment_downloads_with_its_name_and_bytes() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, http_addr) = start_server(working_directory.path());
    let email_id = send_code_email(working_directory.path(), &http_addr);
    let output_path = working_directory.path().join("downloaded.png");

    let download = run_command(
        working_directory.path(),
        &http_addr,
        &[
            "email",
            "attachments",
            &email_id,
            "0",
            "--output",
            output_path.to_str().unwrap_or_default(),
        ],
    );
    let response = send_http_get(
        &http_addr,
        &format!("/api/v1/emails/{email_id}/attachments/0"),
    )
    .expect("the attachment answers");

    assert_eq!(download.status.code(), Some(0));
    assert_eq!(
        std::fs::read(&output_path)
            .expect("the file was written")
            .len(),
        70
    );
    assert!(response.contains("content-disposition: attachment; filename=\"logo.png\""));
    assert!(response.contains("content-type: image/png"));
}

#[test]
fn waiting_for_an_email_that_never_comes_exits_with_the_timeout_code() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, http_addr) = start_server(working_directory.path());

    let output = run_command(
        working_directory.path(),
        &http_addr,
        &[
            "email",
            "wait",
            "--to",
            "nobody@example.test",
            "--timeout",
            "500ms",
        ],
    );

    assert_eq!(output.status.code(), Some(4));
}

#[test]
fn delete_all_asks_for_yes_then_empties_the_mailbox() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (_sendmock, http_addr) = start_server(working_directory.path());
    send_code_email(working_directory.path(), &http_addr);

    let refused = run_command(
        working_directory.path(),
        &http_addr,
        &["email", "delete-all"],
    );
    let confirmed = run_command(
        working_directory.path(),
        &http_addr,
        &["email", "delete-all", "--yes"],
    );
    let remaining = stdout_json(&run_command(
        working_directory.path(),
        &http_addr,
        &["email", "list"],
    ));

    assert_eq!(refused.status.code(), Some(2));
    assert_eq!(confirmed.status.code(), Some(0));
    assert_eq!(remaining["total_count"], 0);
}

// AC: EM-03.3
#[test]
fn an_in_memory_database_leaves_nothing_on_disk() {
    let working_directory = tempfile::tempdir().expect("temporary folder");
    let (sendmock, http_addr) = start_server(working_directory.path());
    send_code_email(working_directory.path(), &http_addr);
    drop(sendmock);

    let files_left: Vec<_> = std::fs::read_dir(working_directory.path())
        .expect("the folder reads")
        .collect();

    assert!(files_left.is_empty(), "files left: {files_left:?}");
}
