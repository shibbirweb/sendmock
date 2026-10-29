use std::io;
use std::net::SocketAddr;
use std::sync::Arc;

use rustls::pki_types::pem::PemObject;
use rustls::pki_types::{CertificateDer, ServerName};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio_rustls::TlsConnector;
use tokio_rustls::client::TlsStream;

/// A line-based SMTP client for tests; replies come back whole, every line included.
pub struct SmtpTestClient<Stream> {
    reader: BufReader<Stream>,
}

impl<Stream: AsyncRead + AsyncWrite + Unpin> SmtpTestClient<Stream> {
    pub fn new(stream: Stream) -> Self {
        Self {
            reader: BufReader::new(stream),
        }
    }

    pub async fn read_reply(&mut self) -> io::Result<String> {
        let mut reply_text = String::new();
        loop {
            let mut reply_line = String::new();
            if self.reader.read_line(&mut reply_line).await? == 0 {
                return Err(io::Error::new(
                    io::ErrorKind::UnexpectedEof,
                    "the server closed the connection",
                ));
            }
            let is_last_line = reply_line.as_bytes().get(3) != Some(&b'-');
            reply_text.push_str(&reply_line);
            if is_last_line {
                return Ok(reply_text);
            }
        }
    }

    pub async fn send_text(&mut self, text: &str) -> io::Result<()> {
        let stream = self.reader.get_mut();
        stream.write_all(text.as_bytes()).await?;
        stream.flush().await
    }

    pub async fn command(&mut self, command_line: &str) -> io::Result<String> {
        self.send_text(&format!("{command_line}\r\n")).await?;
        self.read_reply().await
    }

    /// MAIL, RCPT for each recipient, DATA and the message; answers the reply to the message.
    pub async fn send_message(
        &mut self,
        mail_from: &str,
        recipients: &[&str],
        message: &str,
    ) -> io::Result<String> {
        expect_code(
            &self.command(&format!("MAIL FROM:<{mail_from}>")).await?,
            250,
        )?;
        for recipient in recipients {
            expect_code(&self.command(&format!("RCPT TO:<{recipient}>")).await?, 250)?;
        }
        expect_code(&self.command("DATA").await?, 354)?;
        self.send_text(&format!("{message}\r\n.\r\n")).await?;
        self.read_reply().await
    }

    pub fn into_stream(self) -> Stream {
        self.reader.into_inner()
    }
}

pub fn reply_code(reply_text: &str) -> u16 {
    reply_text
        .get(..3)
        .and_then(|code_text| code_text.parse().ok())
        .unwrap_or_default()
}

fn expect_code(reply_text: &str, expected_code: u16) -> io::Result<()> {
    if reply_code(reply_text) == expected_code {
        Ok(())
    } else {
        Err(io::Error::other(format!(
            "expected {expected_code}, got {reply_text}"
        )))
    }
}

/// Connects and reads the greeting.
pub async fn connect(smtp_addr: SocketAddr) -> io::Result<SmtpTestClient<TcpStream>> {
    let mut client = SmtpTestClient::new(TcpStream::connect(smtp_addr).await?);
    expect_code(&client.read_reply().await?, 220)?;
    Ok(client)
}

/// Runs STARTTLS and the handshake, trusting only `certificate_pem`.
pub async fn start_tls(
    mut client: SmtpTestClient<TcpStream>,
    certificate_pem: &str,
) -> io::Result<SmtpTestClient<TlsStream<TcpStream>>> {
    expect_code(&client.command("STARTTLS").await?, 220)?;
    let tls_stream = build_tls_connector(certificate_pem)?
        .connect(localhost_name()?, client.into_stream())
        .await?;
    Ok(SmtpTestClient::new(tls_stream))
}

/// Connects to an SMTPS listener and reads the greeting over TLS.
pub async fn connect_with_tls(
    smtps_addr: SocketAddr,
    certificate_pem: &str,
) -> io::Result<SmtpTestClient<TlsStream<TcpStream>>> {
    let tcp_stream = TcpStream::connect(smtps_addr).await?;
    let tls_stream = build_tls_connector(certificate_pem)?
        .connect(localhost_name()?, tcp_stream)
        .await?;
    let mut client = SmtpTestClient::new(tls_stream);
    expect_code(&client.read_reply().await?, 220)?;
    Ok(client)
}

fn localhost_name() -> io::Result<ServerName<'static>> {
    ServerName::try_from("localhost").map_err(io::Error::other)
}

fn build_tls_connector(certificate_pem: &str) -> io::Result<TlsConnector> {
    let mut root_store = rustls::RootCertStore::empty();
    for certificate in CertificateDer::pem_slice_iter(certificate_pem.as_bytes()) {
        root_store
            .add(certificate.map_err(io::Error::other)?)
            .map_err(io::Error::other)?;
    }
    let client_config = rustls::ClientConfig::builder_with_provider(Arc::new(
        rustls::crypto::ring::default_provider(),
    ))
    .with_safe_default_protocol_versions()
    .map_err(io::Error::other)?
    .with_root_certificates(root_store)
    .with_no_client_auth();
    Ok(TlsConnector::from(Arc::new(client_config)))
}

/// A small message whose headers name `to_header` and `cc_header` as visible recipients.
pub fn build_test_message(subject: &str, to_header: &str, cc_header: Option<&str>) -> String {
    let message_id = subject.replace(' ', "-");
    let cc_line = cc_header
        .map(|cc_address| format!("Cc: {cc_address}\r\n"))
        .unwrap_or_default();
    format!(
        "From: App <app@shop.test>\r\nTo: {to_header}\r\n{cc_line}Subject: {subject}\r\nMessage-ID: <{message_id}@shop.test>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello from the test suite.\r\nYour code is 482913."
    )
}
