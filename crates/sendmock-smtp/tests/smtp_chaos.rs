#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod smtp_test_client;
    pub mod test_smtp_server;
}

use std::io;
use std::time::{Duration, Instant};

use sendmock_ops::AppSettings;
use support::smtp_test_client::{build_test_message, connect, reply_code};
use support::test_smtp_server::TestSmtpServer;

async fn set_chaos(
    server: &TestSmtpServer,
    change: impl FnOnce(AppSettings) -> AppSettings,
) -> io::Result<()> {
    let settings_store = &server.operation_context.settings_store;
    let current_settings = settings_store.current().await.map_err(io::Error::other)?;
    settings_store
        .save(change(current_settings), 0)
        .await
        .map_err(io::Error::other)?;
    Ok(())
}

// AC: EM-15.1
#[tokio::test]
async fn reject_next_n_refuses_exactly_n_messages_with_the_chosen_code() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    set_chaos(&server, |settings| AppSettings {
        chaos_smtp_reject_next_count: 2,
        chaos_smtp_reject_code: 451,
        ..settings
    })
    .await?;
    let mut client = connect(server.smtp_addr).await?;
    client.command("EHLO app.test").await?;

    let mut reply_codes = Vec::new();
    for subject in ["First", "Second", "Third"] {
        let reply = client
            .send_message(
                "app@shop.test",
                &["sam@example.test"],
                &build_test_message(subject, "sam@example.test", None),
            )
            .await?;
        reply_codes.push(reply_code(&reply));
    }

    assert_eq!(reply_codes, [451, 451, 250]);
    let stored_emails = server.list_emails().await?;
    assert_eq!(stored_emails.len(), 1);
    assert_eq!(stored_emails[0].subject, "Third");
    let settings = server
        .operation_context
        .settings_store
        .current()
        .await
        .map_err(io::Error::other)?;
    assert_eq!(settings.chaos_smtp_reject_next_count, 0);
    Ok(())
}

// AC: EM-15.2
#[tokio::test]
async fn recipients_matching_the_pattern_are_refused_with_550() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    set_chaos(&server, |settings| AppSettings {
        chaos_smtp_reject_recipient_pattern: Some("*@bounce.test".to_owned()),
        ..settings
    })
    .await?;
    let mut client = connect(server.smtp_addr).await?;
    client.command("EHLO app.test").await?;
    client.command("MAIL FROM:<app@shop.test>").await?;

    let refused = client.command("RCPT TO:<sam@Bounce.test>").await?;
    let accepted = client.command("RCPT TO:<sam@example.test>").await?;

    assert_eq!(reply_code(&refused), 550, "{refused}");
    assert_eq!(reply_code(&accepted), 250, "{accepted}");
    Ok(())
}

// AC: EM-15.3
#[tokio::test]
async fn replies_wait_the_latency_and_a_drop_during_data_leaves_the_client_without_an_answer()
-> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    set_chaos(&server, |settings| AppSettings {
        chaos_smtp_command_latency_ms: 150,
        is_chaos_smtp_drop_during_data_enabled: true,
        ..settings
    })
    .await?;
    let mut client = connect(server.smtp_addr).await?;

    let started_at = Instant::now();
    client.command("EHLO app.test").await?;
    let ehlo_duration = started_at.elapsed();
    let sent = client
        .send_message(
            "app@shop.test",
            &["sam@example.test"],
            &build_test_message("Dropped", "sam@example.test", None),
        )
        .await;

    assert!(
        ehlo_duration >= Duration::from_millis(150),
        "{ehlo_duration:?}"
    );
    assert!(sent.is_err(), "{sent:?}");
    assert!(server.list_emails().await?.is_empty());
    Ok(())
}
