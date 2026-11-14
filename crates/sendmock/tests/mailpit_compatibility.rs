#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::io::{self, BufRead, BufReader, Write};
use std::net::TcpStream;

use support::http_get::send_http_get;
use support::sendmock_process::{SendmockProcess, sendmock_command};

/// Sends one line (or nothing, for the greeting) and answers the reply's code.
fn exchange(reader: &mut BufReader<TcpStream>, line: Option<&str>) -> io::Result<u16> {
    if let Some(line) = line {
        reader
            .get_mut()
            .write_all(format!("{line}\r\n").as_bytes())?;
    }
    loop {
        let mut reply_line = String::new();
        reader.read_line(&mut reply_line)?;
        if reply_line.as_bytes().get(3) != Some(&b'-') {
            return Ok(reply_line
                .get(..3)
                .and_then(|code| code.parse().ok())
                .unwrap_or_default());
        }
    }
}

/// Sends a verification email the way an app's mailer does.
fn send_verification_email(smtp_addr: &str) -> io::Result<()> {
    let mut reader = BufReader::new(TcpStream::connect(smtp_addr)?);
    let reply_codes = [
        exchange(&mut reader, None)?,
        exchange(&mut reader, Some("EHLO app.test"))?,
        exchange(&mut reader, Some("MAIL FROM:<no-reply@app.test>"))?,
        exchange(&mut reader, Some("RCPT TO:<sam@example.test>"))?,
        exchange(&mut reader, Some("DATA"))?,
        exchange(
            &mut reader,
            Some(
                "From: App <no-reply@app.test>\r\nTo: sam@example.test\r\nSubject: Verify your email\r\nX-Tags: signup\r\n\r\nYour code is 482913.\r\n.",
            ),
        )?,
        exchange(&mut reader, Some("QUIT"))?,
    ];
    assert_eq!(reply_codes, [220, 250, 250, 250, 354, 250, 221]);
    Ok(())
}

fn read_json(http_addr: &str, path: &str) -> io::Result<serde_json::Value> {
    let response = send_http_get(http_addr, path)?;
    let body_text = response.split("\r\n\r\n").nth(1).unwrap_or_default();
    serde_json::from_str(body_text).map_err(io::Error::other)
}

// AC: EM-19.5
#[test]
fn mail_sent_over_smtp_reads_back_through_mailpits_api() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start(sendmock_command(working_directory.path()).args([
        "--http-addr",
        "127.0.0.1:0",
        "--smtp-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
        "--log-format",
        "json",
    ]))?;
    let ready_addresses = sendmock.wait_for_ready_addresses();

    send_verification_email(&ready_addresses.smtp_addr)?;
    let search = read_json(
        &ready_addresses.http_addr,
        "/api/v1/search?query=to:sam@example.test",
    )?;
    let latest = read_json(&ready_addresses.http_addr, "/api/v1/message/latest")?;

    assert_eq!(search["messages_count"], 1, "{search}");
    assert_eq!(search["messages"][0]["Subject"], "Verify your email");
    assert_eq!(
        search["messages"][0]["To"][0]["Address"],
        "sam@example.test"
    );
    assert_eq!(latest["From"]["Name"], "App");
    assert_eq!(latest["Tags"], serde_json::json!(["signup"]));
    assert!(
        latest["Text"]
            .as_str()
            .unwrap_or_default()
            .contains("482913"),
        "{latest}"
    );
    Ok(())
}
