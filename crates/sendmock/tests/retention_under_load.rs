#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::io::{self, BufRead, BufReader, Write};
use std::net::TcpStream;
use std::path::Path;
use std::time::{Duration, Instant};

use support::http_get::send_http_get;
use support::sendmock_process::{SendmockProcess, sendmock_command};

const MAX_EMAILS: u64 = 100;
/// Longer than the retention task's 10 second interval, so a prune runs while mail arrives.
const SENDING_ROUND: Duration = Duration::from_secs(11);
const PRUNE_WAIT: Duration = Duration::from_secs(30);
/// The `journal_size_limit` file databases are opened with.
const WAL_SIZE_LIMIT_BYTES: u64 = 4 * 1024 * 1024;

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

/// Sends mail over one connection for a whole round; answers the slowest message.
fn send_mail_for_a_round(smtp_addr: &str, message_body: &str) -> io::Result<Duration> {
    let mut reader = BufReader::new(TcpStream::connect(smtp_addr)?);
    exchange(&mut reader, None)?;
    exchange(&mut reader, Some("EHLO load.test"))?;
    let round_started_at = Instant::now();
    let mut slowest_message = Duration::ZERO;
    while round_started_at.elapsed() < SENDING_ROUND {
        let message_started_at = Instant::now();
        let reply_codes = [
            exchange(&mut reader, Some("MAIL FROM:<app@shop.test>"))?,
            exchange(&mut reader, Some("RCPT TO:<load@example.test>"))?,
            exchange(&mut reader, Some("DATA"))?,
            exchange(&mut reader, Some(message_body))?,
        ];
        assert_eq!(reply_codes, [250, 250, 354, 250]);
        slowest_message = slowest_message.max(message_started_at.elapsed());
    }
    exchange(&mut reader, Some("QUIT"))?;
    Ok(slowest_message)
}

fn read_email_count(http_addr: &str) -> io::Result<u64> {
    let response = send_http_get(http_addr, "/api/v1/emails?limit=1")?;
    let body_text = response.split("\r\n\r\n").nth(1).unwrap_or_default();
    let email_page: serde_json::Value =
        serde_json::from_str(body_text).map_err(io::Error::other)?;
    Ok(email_page["total_count"].as_u64().unwrap_or_default())
}

fn wait_until_pruned(http_addr: &str) -> io::Result<()> {
    let deadline = Instant::now() + PRUNE_WAIT;
    while read_email_count(http_addr)? > MAX_EMAILS {
        if Instant::now() > deadline {
            return Err(io::Error::other("the retention task never pruned the mail"));
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    Ok(())
}

/// The database and its write-ahead log together, the space SendMock takes on disk.
fn database_size_bytes(database_path: &Path) -> u64 {
    ["", "-wal"]
        .iter()
        .filter_map(|suffix| std::fs::metadata(format!("{}{suffix}", database_path.display())).ok())
        .map(|metadata| metadata.len())
        .sum()
}

/// The size once the retention task has finished vacuuming and trimming the log: two equal
/// readings half a second apart.
fn wait_for_settled_size(database_path: &Path) -> u64 {
    let deadline = Instant::now() + Duration::from_secs(10);
    let mut previous_size = database_size_bytes(database_path);
    loop {
        std::thread::sleep(Duration::from_millis(500));
        let current_size = database_size_bytes(database_path);
        if current_size == previous_size || Instant::now() > deadline {
            return current_size;
        }
        previous_size = current_size;
    }
}

// AC: PL-08.2
#[test]
#[cfg_attr(
    windows,
    ignore = "stalls on shared Windows CI runners: https://github.com/shibbirweb/sendmock/issues/171"
)]
fn pruning_keeps_the_database_size_stable_and_never_holds_up_smtp() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let database_path = working_directory.path().join("sendmock.db");
    let sendmock = SendmockProcess::start(sendmock_command(working_directory.path()).args([
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        &database_path.display().to_string(),
        "--max-emails",
        &MAX_EMAILS.to_string(),
        "--log-format",
        "json",
    ]))?;
    let ready_addresses = sendmock.wait_for_ready_addresses();
    let message_body = format!(
        "Subject: Load\r\n\r\n{}\r\n.",
        "A line of a fairly long order confirmation.\r\n".repeat(80)
    );

    let slowest_in_first_round = send_mail_for_a_round(&ready_addresses.smtp_addr, &message_body)?;
    wait_until_pruned(&ready_addresses.http_addr)?;
    let size_after_first_round = wait_for_settled_size(&database_path);
    let slowest_in_second_round = send_mail_for_a_round(&ready_addresses.smtp_addr, &message_body)?;
    wait_until_pruned(&ready_addresses.http_addr)?;
    let size_after_second_round = wait_for_settled_size(&database_path);

    let slowest_message = slowest_in_first_round.max(slowest_in_second_round);
    assert!(
        slowest_message < Duration::from_secs(2),
        "{slowest_message:?}"
    );
    // The write-ahead log may sit anywhere up to its 4 MiB limit, depending on whether the last
    // checkpoint could run; growth beyond that and a quarter means pruning is not keeping up.
    assert!(
        size_after_second_round
            <= size_after_first_round + size_after_first_round / 4 + WAL_SIZE_LIMIT_BYTES,
        "{size_after_first_round} bytes after the first round, {size_after_second_round} after the second"
    );
    Ok(())
}
