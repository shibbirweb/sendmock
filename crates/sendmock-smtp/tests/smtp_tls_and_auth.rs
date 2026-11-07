#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod smtp_test_client;
    pub mod test_smtp_server;
}

use std::io;

use sendmock_smtp::encode_base64_text;
use support::smtp_test_client::{
    build_test_message, connect, connect_with_tls, reply_code, start_tls,
};
use support::test_smtp_server::{TestServerOptions, TestSmtpServer};

// AC: EM-02.1
#[tokio::test]
async fn starttls_works_with_the_certificate_generated_on_first_run() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    let mut client = connect(server.smtp_addr).await?;
    let plain_ehlo = client.command("EHLO app.test").await?;

    let mut tls_client = start_tls(client, &server.generated_certificate_pem()?).await?;
    let tls_ehlo = tls_client.command("EHLO app.test").await?;
    let final_reply = tls_client
        .send_message(
            "app@shop.test",
            &["a@one.test"],
            &build_test_message("Over TLS", "a@one.test", None),
        )
        .await?;
    tls_client.command("QUIT").await?;
    let sessions = server.wait_for_sessions(1).await?;

    assert!(plain_ehlo.contains("STARTTLS"));
    assert!(!tls_ehlo.contains("STARTTLS"));
    assert_eq!(reply_code(&final_reply), 250);
    assert_eq!(sessions[0].tls_version.as_deref(), Some("TLSv1.3"));
    Ok(())
}

// AC: EM-02.1
#[tokio::test]
async fn starttls_works_with_a_certificate_the_user_provides() -> io::Result<()> {
    let certificate_folder = tempfile::tempdir()?;
    let user_certificate = rcgen::generate_simple_self_signed(vec!["localhost".to_owned()])
        .map_err(io::Error::other)?;
    let certificate_file = certificate_folder.path().join("cert.pem");
    let key_file = certificate_folder.path().join("key.pem");
    std::fs::write(&certificate_file, user_certificate.cert.pem())?;
    std::fs::write(&key_file, user_certificate.signing_key.serialize_pem())?;
    let server = TestSmtpServer::start_with(TestServerOptions {
        certificate_files: Some((certificate_file, key_file)),
        ..TestServerOptions::default()
    })
    .await?;
    let mut client = connect(server.smtp_addr).await?;
    client.command("EHLO app.test").await?;

    let mut tls_client = start_tls(client, &user_certificate.cert.pem()).await?;

    assert_eq!(reply_code(&tls_client.command("EHLO app.test").await?), 250);
    assert!(
        std::fs::read_dir(server.generated_folder.path())?
            .next()
            .is_none()
    );
    Ok(())
}

// AC: EM-02.2
#[tokio::test]
async fn the_smtps_listener_speaks_tls_from_the_first_byte() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;

    let mut tls_client =
        connect_with_tls(server.smtps_addr, &server.generated_certificate_pem()?).await?;
    let ehlo_reply = tls_client.command("EHLO app.test").await?;
    let final_reply = tls_client
        .send_message(
            "app@shop.test",
            &["a@one.test"],
            &build_test_message("Over SMTPS", "a@one.test", None),
        )
        .await?;

    assert!(!ehlo_reply.contains("STARTTLS"));
    assert_eq!(reply_code(&final_reply), 250);
    assert_eq!(server.list_emails().await?[0].subject, "Over SMTPS");
    Ok(())
}

// AC: EM-02.5
#[tokio::test]
async fn the_authenticated_username_is_stored_on_the_email_and_the_session() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    let mut client = connect(server.smtp_addr).await?;
    client.command("EHLO app.test").await?;

    let auth_reply = client
        .command(&format!(
            "AUTH PLAIN {}",
            encode_base64_text("\0qa-user\0top-secret")
        ))
        .await?;
    client
        .send_message(
            "app@shop.test",
            &["a@one.test"],
            &build_test_message("Signed in", "a@one.test", None),
        )
        .await?;
    client.command("QUIT").await?;
    let emails = server.list_emails().await?;
    let sessions = server.wait_for_sessions(1).await?;

    assert_eq!(reply_code(&auth_reply), 235);
    assert_eq!(emails[0].smtp_auth_user.as_deref(), Some("qa-user"));
    assert_eq!(sessions[0].auth_user.as_deref(), Some("qa-user"));
    assert_eq!(sessions[0].auth_mechanism.as_deref(), Some("PLAIN"));
    Ok(())
}

// AC: EM-09.2
#[tokio::test]
async fn the_session_log_masks_passwords_and_links_the_message_instead_of_copying_it()
-> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    let mut client = connect(server.smtp_addr).await?;
    client.command("EHLO app.test").await?;
    let credentials = encode_base64_text("\0qa-user\0top-secret");
    client.command(&format!("AUTH PLAIN {credentials}")).await?;

    client
        .send_message(
            "app@shop.test",
            &["a@one.test"],
            &build_test_message("Logged", "a@one.test", None),
        )
        .await?;
    client.command("QUIT").await?;
    let emails = server.list_emails().await?;
    let sessions = server.wait_for_sessions(1).await?;

    let transcript = &sessions[0].transcript;
    assert!(transcript.contains("MAIL FROM:<app@shop.test>"));
    assert!(!transcript.contains(&credentials));
    assert!(!transcript.contains("Hello from the test suite"));
    assert_eq!(sessions[0].result, "delivered");
    assert_eq!(sessions[0].email_ids, [emails[0].email_id.clone()]);
    assert_eq!(
        emails[0].smtp_session_id.as_deref(),
        Some(sessions[0].session_id.as_str())
    );
    Ok(())
}

#[tokio::test]
async fn a_client_that_disconnects_mid_session_is_logged_as_aborted() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    let mut client = connect(server.smtp_addr).await?;
    client.command("EHLO app.test").await?;
    client.command("MAIL FROM:<app@shop.test>").await?;

    drop(client);
    let sessions = server.wait_for_sessions(1).await?;

    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].result, "aborted");
    assert_eq!(sessions[0].helo_name, "app.test");
    assert!(sessions[0].failure_reason.is_some());
    Ok(())
}
