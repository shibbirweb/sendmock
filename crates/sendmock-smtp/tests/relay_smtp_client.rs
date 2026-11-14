#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod smtp_test_client;
    pub mod test_smtp_server;
}

use std::io;
use std::sync::Arc;

use rustls::pki_types::CertificateDer;
use rustls::pki_types::pem::PemObject;
use sendmock_ops::{EmailRelay, RelayMessage};
use sendmock_smtp::RelaySmtpClient;
use support::smtp_test_client::build_test_message;
use support::test_smtp_server::TestSmtpServer;

/// A relay client that trusts the test listener's generated certificate.
fn build_relay_client(certificate_pem: &str) -> io::Result<RelaySmtpClient> {
    let mut root_store = rustls::RootCertStore::empty();
    for certificate in CertificateDer::pem_slice_iter(certificate_pem.as_bytes()) {
        root_store
            .add(certificate.map_err(io::Error::other)?)
            .map_err(io::Error::other)?;
    }
    let tls_config = rustls::ClientConfig::builder_with_provider(Arc::new(
        rustls::crypto::ring::default_provider(),
    ))
    .with_safe_default_protocol_versions()
    .map_err(io::Error::other)?
    .with_root_certificates(root_store)
    .with_no_client_auth();
    Ok(RelaySmtpClient::new(Arc::new(tls_config)))
}

// AC: EM-14.2
#[tokio::test]
async fn the_relay_client_upgrades_with_starttls_logs_in_and_sends_to_each_recipient()
-> io::Result<()> {
    let relay_server = TestSmtpServer::start().await?;
    let relay_client = build_relay_client(&relay_server.generated_certificate_pem()?)?;
    let relay_url = format!(
        "smtp://mailer:s3cret@localhost:{}",
        relay_server.smtp_addr.port()
    );
    let recipients = vec!["qa@example.test".to_owned(), "lead@example.test".to_owned()];
    let raw_message = build_test_message("Released", "qa@example.test", None);

    let relay_reply = relay_client
        .relay_message(RelayMessage {
            relay_url: &relay_url,
            mail_from: "app@shop.test",
            recipients: &recipients,
            raw_message: raw_message.as_bytes(),
        })
        .await;

    assert!(
        relay_reply
            .as_ref()
            .is_ok_and(|reply| reply.starts_with("250")),
        "{relay_reply:?}"
    );
    let relayed_emails = relay_server.list_emails().await?;
    assert_eq!(relayed_emails.len(), 1);
    assert_eq!(relayed_emails[0].subject, "Released");
    assert_eq!(relayed_emails[0].envelope_from, "app@shop.test");
    assert_eq!(relayed_emails[0].envelope_to, recipients);
    assert_eq!(relayed_emails[0].smtp_auth_user.as_deref(), Some("mailer"));
    let sessions = relay_server.wait_for_sessions(1).await?;
    assert_eq!(sessions[0].tls_version.as_deref(), Some("TLSv1.3"));
    Ok(())
}

// AC: EM-14.2
#[tokio::test]
async fn the_relay_client_speaks_tls_from_the_first_byte_for_smtps() -> io::Result<()> {
    let relay_server = TestSmtpServer::start().await?;
    let relay_client = build_relay_client(&relay_server.generated_certificate_pem()?)?;
    let relay_url = format!("smtps://localhost:{}", relay_server.smtps_addr.port());
    let recipients = vec!["qa@example.test".to_owned()];
    let raw_message = build_test_message("Over SMTPS", "qa@example.test", None);

    let relay_reply = relay_client
        .relay_message(RelayMessage {
            relay_url: &relay_url,
            mail_from: "app@shop.test",
            recipients: &recipients,
            raw_message: raw_message.as_bytes(),
        })
        .await;

    assert!(relay_reply.is_ok(), "{relay_reply:?}");
    assert_eq!(relay_server.list_emails().await?.len(), 1);
    Ok(())
}

#[tokio::test]
async fn a_relay_that_cannot_be_reached_is_an_error_not_a_panic() -> io::Result<()> {
    let relay_client = build_relay_client("")?;
    let closed_listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let closed_port = closed_listener.local_addr()?.port();
    drop(closed_listener);
    let recipients = vec!["qa@example.test".to_owned()];

    let relay_reply = relay_client
        .relay_message(RelayMessage {
            relay_url: &format!("smtp://127.0.0.1:{closed_port}"),
            mail_from: "app@shop.test",
            recipients: &recipients,
            raw_message: b"Subject: Hi\r\n\r\nHello",
        })
        .await;

    assert!(
        relay_reply
            .as_ref()
            .is_err_and(|reason| reason.contains("could not reach the relay")),
        "{relay_reply:?}"
    );
    Ok(())
}
