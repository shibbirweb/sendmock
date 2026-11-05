#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod smtp_test_client;
    pub mod test_smtp_server;
}

use std::io;

use sendmock_ops::AppSettings;
use support::smtp_test_client::{build_test_message, connect};
use support::test_smtp_server::TestSmtpServer;

// AC: EM-17.2
#[tokio::test]
async fn smtp_mail_for_an_inbound_domain_is_stored_as_incoming() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    let settings_store = &server.operation_context.settings_store;
    let current_settings = settings_store.current().await.map_err(io::Error::other)?;
    settings_store
        .save(
            AppSettings {
                inbound_email_domains: vec!["reply.app.test".to_owned()],
                ..current_settings
            },
            0,
        )
        .await
        .map_err(io::Error::other)?;
    let mut client = connect(server.smtp_addr).await?;
    client.command("EHLO app.test").await?;

    client
        .send_message(
            "sam@example.test",
            &["support@reply.app.test"],
            &build_test_message("Help", "support@reply.app.test", None),
        )
        .await?;
    client
        .send_message(
            "app@shop.test",
            &["sam@example.test"],
            &build_test_message("Receipt", "sam@example.test", None),
        )
        .await?;

    let emails = server.list_emails().await?;
    let direction_of = |subject: &str| {
        emails
            .iter()
            .find(|email| email.subject == subject)
            .map(|email| email.direction.clone())
    };
    assert_eq!(direction_of("Help").as_deref(), Some("inbound"));
    assert_eq!(direction_of("Receipt").as_deref(), Some("outbound"));
    Ok(())
}
