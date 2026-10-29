#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::io::{self, BufRead, BufReader, Write};
use std::net::TcpStream;
use std::time::{Duration, Instant};

use support::http_get::send_http_get;
use support::sendmock_process::SendmockProcess;

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

// AC: EM-01.1
#[test]
fn a_message_sent_over_smtp_is_listed_by_the_api_within_a_second() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let http_addr = sendmock.wait_for_http_addr();
    let smtp_addr = sendmock.wait_for_smtp_addr();
    let mut reader = BufReader::new(TcpStream::connect(&smtp_addr)?);

    let reply_codes = [
        exchange(&mut reader, None)?,
        exchange(&mut reader, Some("EHLO app.test"))?,
        exchange(&mut reader, Some("MAIL FROM:<app@shop.test>"))?,
        exchange(&mut reader, Some("RCPT TO:<customer@example.test>"))?,
        exchange(&mut reader, Some("DATA"))?,
        exchange(
            &mut reader,
            Some(
                "From: app@shop.test\r\nTo: customer@example.test\r\nSubject: Order shipped\r\n\r\nOn its way.\r\n.",
            ),
        )?,
    ];
    let sent_at = Instant::now();
    exchange(&mut reader, Some("QUIT"))?;
    let emails_response = send_http_get(&http_addr, "/api/v1/emails")?;

    assert_eq!(reply_codes, [220, 250, 250, 250, 354, 250]);
    assert!(
        emails_response.contains("\"subject\":\"Order shipped\""),
        "{emails_response}"
    );
    assert!(sent_at.elapsed() < Duration::from_secs(1));
    Ok(())
}
