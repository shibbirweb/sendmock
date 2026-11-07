#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod smtp_test_client;
    pub mod test_smtp_server;
}

use std::io;
use std::sync::Arc;
use std::time::{Duration, Instant};

use support::smtp_test_client::{SmtpTestClient, build_test_message, connect, reply_code};
use support::test_smtp_server::{TestServerOptions, TestSmtpServer};
use tokio::net::TcpStream;
use tokio::sync::{Barrier, Semaphore};

const CONCURRENT_SESSION_COUNT: usize = 500;
const LOAD_TEST_TIMEOUT: Duration = Duration::from_secs(120);
/// Connections still in their TCP handshake at once. Linux runners keep 256 half-open
/// connections (`tcp_max_syn_backlog`) and then answer with SYN cookies, where a lost final ACK
/// leaves the client connected and the server unaware; as SMTP waits for the server's greeting,
/// such a session never starts. Apps do not open 500 connections in the same instant, so the
/// sessions connect a batch at a time and are then all open together.
const CONNECTS_IN_FLIGHT: usize = 64;

// AC: EM-01.1
// AC: EM-01.2
#[tokio::test]
async fn a_message_for_any_domain_is_stored_before_data_is_answered() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    let mut client = connect(server.smtp_addr).await?;
    client.command("EHLO app.test").await?;
    let sent_at = Instant::now();

    let final_reply = client
        .send_message(
            "app@shop.test",
            &["anyone@nowhere.invalid"],
            &build_test_message("Welcome", "anyone@nowhere.invalid", None),
        )
        .await?;
    let emails = server.list_emails().await?;

    assert_eq!(reply_code(&final_reply), 250);
    assert!(sent_at.elapsed() < Duration::from_secs(1));
    assert_eq!(emails.len(), 1);
    assert_eq!(emails[0].subject, "Welcome");
    assert_eq!(emails[0].source, "smtp");
    assert_eq!(reply_code(&client.command("QUIT").await?), 221);
    Ok(())
}

// AC: EM-01.4
#[tokio::test]
async fn several_recipients_make_one_email_and_hidden_ones_show_as_bcc() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    let mut client = connect(server.smtp_addr).await?;
    client.command("EHLO app.test").await?;

    client
        .send_message(
            "app@shop.test",
            &["ana@one.test", "ben@two.test", "hidden@three.test"],
            &build_test_message("Team update", "ana@one.test", Some("ben@two.test")),
        )
        .await?;
    let emails = server.list_emails().await?;

    assert_eq!(emails.len(), 1);
    assert_eq!(
        emails[0].envelope_to,
        ["ana@one.test", "ben@two.test", "hidden@three.test"]
    );
    let bcc_addresses: Vec<&str> = emails[0]
        .bcc
        .iter()
        .map(|bcc| bcc.address.as_str())
        .collect();
    assert_eq!(bcc_addresses, ["hidden@three.test"]);
    Ok(())
}

// AC: EM-01.3
#[tokio::test]
async fn advertises_the_extensions_and_answers_pipelined_commands_in_order() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    let mut client = connect(server.smtp_addr).await?;

    let ehlo_reply = client.command("EHLO app.test").await?;
    client
        .send_text(
            "MAIL FROM:<app@shop.test>\r\nRCPT TO:<a@one.test>\r\nRCPT TO:<b@two.test>\r\nDATA\r\n",
        )
        .await?;
    let mut pipelined_codes = Vec::new();
    for _ in 0..4 {
        pipelined_codes.push(reply_code(&client.read_reply().await?));
    }
    client
        .send_text(&format!(
            "{}\r\n.\r\n",
            build_test_message("Pipelined", "a@one.test", None)
        ))
        .await?;

    for extension in [
        "PIPELINING",
        "8BITMIME",
        "SMTPUTF8",
        "SIZE 1048576",
        "STARTTLS",
        "AUTH PLAIN LOGIN CRAM-MD5",
    ] {
        assert!(
            ehlo_reply.contains(extension),
            "{extension} is not advertised in {ehlo_reply}"
        );
    }
    assert_eq!(pipelined_codes, [250, 250, 250, 354]);
    assert_eq!(reply_code(&client.read_reply().await?), 250);
    Ok(())
}

// AC: EM-01.3
#[tokio::test]
async fn a_message_over_the_size_limit_gets_552_and_the_session_goes_on() -> io::Result<()> {
    let server = TestSmtpServer::start_with(TestServerOptions {
        max_size_bytes: 1024,
        ..TestServerOptions::default()
    })
    .await?;
    let mut client = connect(server.smtp_addr).await?;
    client.command("EHLO app.test").await?;
    let large_message = format!(
        "{}\r\n{}",
        build_test_message("Large", "a@one.test", None),
        "x".repeat(4096)
    );

    let final_reply = client
        .send_message("app@shop.test", &["a@one.test"], &large_message)
        .await?;

    assert_eq!(reply_code(&final_reply), 552);
    assert_eq!(reply_code(&client.command("NOOP").await?), 250);
    assert!(server.list_emails().await?.is_empty());
    Ok(())
}

// AC: EM-01.6
#[tokio::test]
async fn garbage_and_overlong_lines_get_errors_and_the_server_keeps_working() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    let mut client = connect(server.smtp_addr).await?;

    let garbage_reply = client.command("\u{1}\u{7f} not smtp at all").await?;
    let overlong_reply = client.command(&"A".repeat(5000)).await?;
    let ehlo_reply = client.command("EHLO app.test").await?;
    let final_reply = client
        .send_message(
            "app@shop.test",
            &["a@one.test"],
            &build_test_message("Still working", "a@one.test", None),
        )
        .await?;

    assert_eq!(reply_code(&garbage_reply), 500);
    assert_eq!(reply_code(&overlong_reply), 500);
    assert_eq!(reply_code(&ehlo_reply), 250);
    assert_eq!(reply_code(&final_reply), 250);
    Ok(())
}

// AC: EM-01.6
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn handles_500_sessions_open_at_the_same_time() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    let all_connected = Arc::new(Barrier::new(CONCURRENT_SESSION_COUNT));
    let connect_slots = Arc::new(Semaphore::new(CONNECTS_IN_FLIGHT));
    let mut sessions = tokio::task::JoinSet::new();

    for session_number in 0..CONCURRENT_SESSION_COUNT {
        let smtp_addr = server.smtp_addr;
        let all_connected = Arc::clone(&all_connected);
        let connect_slots = Arc::clone(&connect_slots);
        sessions.spawn(async move {
            // Every session reaches the barrier, even one whose connect failed,
            // so a single failure ends the test instead of blocking the other sessions.
            let connect_slot = connect_slots
                .acquire_owned()
                .await
                .map_err(io::Error::other)?;
            let connect_result = connect(smtp_addr).await;
            drop(connect_slot);
            all_connected.wait().await;
            send_one_concurrent_message(connect_result?, session_number).await
        });
    }
    let final_codes = tokio::time::timeout(LOAD_TEST_TIMEOUT, async {
        let mut final_codes = Vec::new();
        while let Some(session_result) = sessions.join_next().await {
            final_codes.push(session_result.map_err(io::Error::other)??);
        }
        Ok::<Vec<u16>, io::Error>(final_codes)
    })
    .await
    .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "the sessions did not finish"))??;

    assert!(final_codes.iter().all(|final_code| *final_code == 250));
    assert_eq!(server.list_emails().await?.len(), CONCURRENT_SESSION_COUNT);
    Ok(())
}

async fn send_one_concurrent_message(
    mut client: SmtpTestClient<TcpStream>,
    session_number: usize,
) -> io::Result<u16> {
    client.command("EHLO app.test").await?;
    let subject = format!("Concurrent {session_number}");
    let final_reply = client
        .send_message(
            "app@shop.test",
            &["load@one.test"],
            &build_test_message(&subject, "load@one.test", None),
        )
        .await?;
    client.command("QUIT").await?;
    Ok(reply_code(&final_reply))
}
