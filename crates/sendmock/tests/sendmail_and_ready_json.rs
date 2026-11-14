#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde_json::Value;
use support::http_get::send_http_get;
use support::sendmock_process::{SendmockProcess, sendmock_command};

const MESSAGE_WITH_BARE_LINE_FEEDS: &str = "From: Shop <app@shop.test>\nTo: sam@example.test\nBcc: hidden@example.test\nSubject: Via sendmail\n\nHello from the shim.\n";

fn get_json(http_addr: &str, path: &str) -> io::Result<Value> {
    let response = send_http_get(http_addr, path)?;
    serde_json::from_str(response.split("\r\n\r\n").nth(1).unwrap_or_default())
        .map_err(io::Error::other)
}

/// Runs the command with the message on stdin and answers whether it exited 0.
fn pipe_message(command: &mut Command, message: &str) -> io::Result<bool> {
    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .spawn()?;
    child
        .stdin
        .take()
        .ok_or_else(|| io::Error::other("stdin is not piped"))?
        .write_all(message.as_bytes())?;
    Ok(child.wait()?.success())
}

fn latest_email(http_addr: &str) -> io::Result<Value> {
    let email_page = get_json(http_addr, "/api/v1/emails")?;
    let email_id = email_page["items"][0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    get_json(http_addr, &format!("/api/v1/emails/{email_id}"))
}

/// A copy of the binary named `sendmail` (a symlink on Unix), as distributions install it.
fn install_sendmail_name(folder: &Path) -> io::Result<PathBuf> {
    let sendmail_path = folder.join(format!("sendmail{}", std::env::consts::EXE_SUFFIX));
    #[cfg(unix)]
    std::os::unix::fs::symlink(env!("CARGO_BIN_EXE_sendmock"), &sendmail_path)?;
    #[cfg(not(unix))]
    std::fs::copy(env!("CARGO_BIN_EXE_sendmock"), &sendmail_path)?;
    Ok(sendmail_path)
}

// AC: EM-06.1
#[test]
fn sendmail_t_hands_the_message_to_smtp_with_hidden_recipients_kept_hidden() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let ready_addresses = sendmock.wait_for_ready_addresses();

    let is_accepted = pipe_message(
        sendmock_command(working_directory.path())
            .args(["sendmail", "-t", "-i"])
            .env("SENDMOCK_SMTP_ADDR", &ready_addresses.smtp_addr),
        MESSAGE_WITH_BARE_LINE_FEEDS,
    )?;
    let email = latest_email(&ready_addresses.http_addr)?;

    assert!(is_accepted);
    assert_eq!(email["source"], "smtp");
    assert_eq!(email["subject"], "Via sendmail");
    assert_eq!(
        email["envelope_to"],
        serde_json::json!(["sam@example.test", "hidden@example.test"])
    );
    assert_eq!(email["bcc"][0]["address"], "hidden@example.test");
    Ok(())
}

// AC: EM-06.3
#[test]
fn a_binary_named_sendmail_behaves_the_same_and_f_sets_the_sender() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let ready_addresses = sendmock.wait_for_ready_addresses();
    let sendmail_path = install_sendmail_name(working_directory.path())?;

    let is_accepted = pipe_message(
        Command::new(&sendmail_path)
            .args(["-f", "bounces@shop.test", "sam@example.test"])
            .env("SENDMOCK_SMTP_ADDR", &ready_addresses.smtp_addr),
        "Subject: Named sendmail\n\nHi\n",
    )?;
    let email = latest_email(&ready_addresses.http_addr)?;

    assert!(is_accepted);
    assert_eq!(email["envelope_from"], "bounces@shop.test");
    assert_eq!(email["subject"], "Named sendmail");
    Ok(())
}

#[test]
fn sendmail_without_a_running_server_fails_with_a_temporary_error() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let unused_port = std::net::TcpListener::bind("127.0.0.1:0")?.local_addr()?;

    let mut child = sendmock_command(working_directory.path())
        .args(["sendmail", "sam@example.test"])
        .env("SENDMOCK_SMTP_ADDR", unused_port.to_string())
        .stdin(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    drop(child.stdin.take());

    assert_eq!(child.wait()?.code(), Some(75));
    Ok(())
}

// AC: PL-03.4
#[test]
fn ready_json_prints_the_bound_addresses_as_the_only_stdout_line() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let mut child = sendmock_command(working_directory.path())
        .args([
            "--ready-json",
            "--http-addr",
            "127.0.0.1:0",
            "--db",
            "memory",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    let mut ready_line = String::new();
    BufReader::new(
        child
            .stdout
            .take()
            .ok_or_else(|| io::Error::other("stdout is not piped"))?,
    )
    .read_line(&mut ready_line)?;
    let _ = child.kill();
    let _ = child.wait();

    let ready_fields: Value = serde_json::from_str(&ready_line).map_err(io::Error::other)?;
    let http_addr = ready_fields["http_addr"].as_str().unwrap_or_default();
    assert!(
        http_addr.starts_with("127.0.0.1:") && !http_addr.ends_with(":0"),
        "{ready_line}"
    );
    assert!(
        ready_fields["smtp_addr"]
            .as_str()
            .is_some_and(|smtp_addr| !smtp_addr.ends_with(":0"))
    );
    assert_eq!(ready_fields["smtps_addr"], Value::Null);
    Ok(())
}
