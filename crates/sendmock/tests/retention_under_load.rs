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
/// Longer than the background checkpoint's 1 second interval: while a vacuum is still under
/// way, each checkpoint shrinks the database file, so the size cannot hold still this long.
const SETTLED_WINDOW: Duration = Duration::from_secs(3);
/// Two prune intervals and more: a prune still running when the round ends, and the next one.
const SETTLE_DEADLINE: Duration = Duration::from_secs(25);
const SMTP_STEPS: [&str; 4] = ["MAIL FROM", "RCPT TO", "DATA", "message body"];
/// The longest one message may take while pruning runs. Windows CI runners get more: with no
/// lock held, their disks still took 3 to 13 s for a log copy that takes milliseconds
/// elsewhere, and a message written meanwhile waited 2 to 6 s (issue 171). A stall from a held
/// lock, which this test is for, took 9 to 54 s there before it was fixed.
const SLOWEST_MESSAGE_LIMIT: Duration = if cfg!(windows) {
    Duration::from_secs(10)
} else {
    Duration::from_secs(2)
};

/// The slowest SMTP message of a round, and the step of it that took longest.
struct SlowestMessage {
    duration: Duration,
    slowest_step: &'static str,
}

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
fn send_mail_for_a_round(smtp_addr: &str, message_body: &str) -> io::Result<SlowestMessage> {
    let mut reader = BufReader::new(TcpStream::connect(smtp_addr)?);
    exchange(&mut reader, None)?;
    exchange(&mut reader, Some("EHLO load.test"))?;
    let smtp_lines = [
        "MAIL FROM:<app@shop.test>",
        "RCPT TO:<load@example.test>",
        "DATA",
        message_body,
    ];
    let round_started_at = Instant::now();
    let mut slowest_message = SlowestMessage {
        duration: Duration::ZERO,
        slowest_step: SMTP_STEPS[0],
    };
    while round_started_at.elapsed() < SENDING_ROUND {
        let mut step_durations = [Duration::ZERO; 4];
        let mut reply_codes = [0; 4];
        for (step_index, smtp_line) in smtp_lines.iter().enumerate() {
            let step_started_at = Instant::now();
            reply_codes[step_index] = exchange(&mut reader, Some(smtp_line))?;
            step_durations[step_index] = step_started_at.elapsed();
        }
        assert_eq!(reply_codes, [250, 250, 354, 250]);
        let message_duration: Duration = step_durations.iter().sum();
        if message_duration > slowest_message.duration {
            let slowest_step_index = (0..SMTP_STEPS.len())
                .max_by_key(|step_index| step_durations[*step_index])
                .unwrap_or_default();
            slowest_message = SlowestMessage {
                duration: message_duration,
                slowest_step: SMTP_STEPS[slowest_step_index],
            };
        }
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

/// The size once the retention task has finished vacuuming and trimming the log: unchanged
/// for a whole settled window.
fn wait_for_settled_size(database_path: &Path) -> u64 {
    let deadline = Instant::now() + SETTLE_DEADLINE;
    let mut settled_size = database_size_bytes(database_path);
    let mut unchanged_since = Instant::now();
    while unchanged_since.elapsed() < SETTLED_WINDOW && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(500));
        let current_size = database_size_bytes(database_path);
        if current_size != settled_size {
            settled_size = current_size;
            unchanged_since = Instant::now();
        }
    }
    settled_size
}

/// Waits for the size to come down to `size_limit_bytes`; answers the last size read.
fn wait_for_size_at_most(database_path: &Path, size_limit_bytes: u64) -> u64 {
    let deadline = Instant::now() + SETTLE_DEADLINE;
    loop {
        let current_size = database_size_bytes(database_path);
        if current_size <= size_limit_bytes || Instant::now() > deadline {
            return current_size;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
}

/// The server's warnings, such as slow database writes and checkpoints, for a failure message.
fn read_warning_lines(sendmock: &SendmockProcess) -> String {
    sendmock
        .read_printed_lines(Duration::from_millis(200))
        .into_iter()
        .filter(|printed_line| printed_line.contains("WARN"))
        .collect::<Vec<_>>()
        .join("\n")
}

// AC: PL-08.2
#[test]
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
    // The write-ahead log may sit anywhere up to its 4 MiB limit, depending on whether the last
    // checkpoint could run; growth beyond that and a quarter means pruning is not keeping up.
    let size_limit_bytes =
        size_after_first_round + size_after_first_round / 4 + WAL_SIZE_LIMIT_BYTES;
    let size_after_second_round = wait_for_size_at_most(&database_path, size_limit_bytes);

    let slowest_message = [slowest_in_first_round, slowest_in_second_round]
        .into_iter()
        .max_by_key(|slowest_message| slowest_message.duration)
        .ok_or_else(|| io::Error::other("no round was sent"))?;
    assert!(
        slowest_message.duration < SLOWEST_MESSAGE_LIMIT,
        "one message took {:?}, most of it in {}; server warnings:\n{}",
        slowest_message.duration,
        slowest_message.slowest_step,
        read_warning_lines(&sendmock)
    );
    assert!(
        size_after_second_round <= size_limit_bytes,
        "{size_after_first_round} bytes after the first round, {size_after_second_round} after the second; server warnings:\n{}",
        read_warning_lines(&sendmock)
    );
    Ok(())
}
