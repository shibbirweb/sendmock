use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use rustls::ClientConfig;
use rustls::pki_types::ServerName;
use rustls_platform_verifier::BuilderVerifierExt;
use sendmock_ops::{EmailRelay, RelayMessage};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::TcpStream;
use tokio_rustls::TlsConnector;

use super::relay_url::{RelayCredentials, RelayUrl};
use super::smtp_conversation::SmtpConversation;
use crate::encode_base64_text;

/// A whole relay session, from connecting to the reply after the message.
const RELAY_TIMEOUT: Duration = Duration::from_secs(60);

trait RelayStream: AsyncRead + AsyncWrite + Unpin + Send {}
impl<Stream: AsyncRead + AsyncWrite + Unpin + Send> RelayStream for Stream {}

type RelayConversation = SmtpConversation<Box<dyn RelayStream>>;

/// Hands released emails to a real SMTP server: STARTTLS when the server offers it (or TLS
/// from the first byte for `smtps://`), `AUTH PLAIN` with the URL's login, then the message.
pub struct RelaySmtpClient {
    tls_connector: TlsConnector,
}

impl RelaySmtpClient {
    /// Trusts the certificates the given configuration trusts, such as a test's own.
    pub fn new(tls_config: Arc<ClientConfig>) -> Self {
        Self {
            tls_connector: TlsConnector::from(tls_config),
        }
    }

    /// Trusts what the operating system trusts, as a mail client would.
    pub fn with_platform_roots() -> Result<Self, rustls::Error> {
        let tls_config =
            ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
                .with_safe_default_protocol_versions()?
                .with_platform_verifier()?
                .with_no_client_auth();
        Ok(Self::new(Arc::new(tls_config)))
    }

    async fn wrap_in_tls(
        &self,
        relay_url: &RelayUrl,
        plain_stream: Box<dyn RelayStream>,
    ) -> Result<Box<dyn RelayStream>, String> {
        let server_name = ServerName::try_from(relay_url.host.clone())
            .map_err(|name_error| name_error.to_string())?;
        let tls_stream = self
            .tls_connector
            .connect(server_name, plain_stream)
            .await
            .map_err(|tls_error| format!("TLS with the relay failed: {tls_error}"))?;
        Ok(Box::new(tls_stream))
    }

    /// Connected, greeted and past `EHLO`, upgraded to TLS where the relay allows it; answers
    /// whether the session is encrypted.
    async fn open_conversation(
        &self,
        relay_url: &RelayUrl,
    ) -> Result<(RelayConversation, bool), String> {
        let tcp_stream = TcpStream::connect((relay_url.host.as_str(), relay_url.port))
            .await
            .map_err(|connect_error| format!("could not reach the relay: {connect_error}"))?;
        let mut stream: Box<dyn RelayStream> = Box::new(tcp_stream);
        if relay_url.is_implicit_tls {
            stream = self.wrap_in_tls(relay_url, stream).await?;
        }
        let mut conversation = SmtpConversation::new(stream);
        conversation.exchange(None, &[220]).await?;
        let ehlo_reply = conversation
            .exchange(Some("EHLO sendmock.local"), &[250])
            .await?;
        if relay_url.is_implicit_tls || !ehlo_reply.to_ascii_uppercase().contains("STARTTLS") {
            return Ok((conversation, relay_url.is_implicit_tls));
        }
        conversation.exchange(Some("STARTTLS"), &[220]).await?;
        let tls_stream = self
            .wrap_in_tls(relay_url, conversation.into_stream())
            .await?;
        let mut tls_conversation = SmtpConversation::new(tls_stream);
        tls_conversation
            .exchange(Some("EHLO sendmock.local"), &[250])
            .await?;
        Ok((tls_conversation, true))
    }

    async fn deliver(&self, relay_message: RelayMessage<'_>) -> Result<String, String> {
        let relay_url = RelayUrl::parse(relay_message.relay_url)?;
        let (mut conversation, is_encrypted) = self.open_conversation(&relay_url).await?;
        if let Some(credentials) = &relay_url.credentials {
            if !is_encrypted && !relay_url.is_loopback() {
                return Err(
                    "the relay offers no TLS, so SendMock will not send it the password".to_owned(),
                );
            }
            authenticate(&mut conversation, credentials).await?;
        }
        conversation
            .exchange(
                Some(&format!("MAIL FROM:<{}>", relay_message.mail_from)),
                &[250],
            )
            .await?;
        for recipient in relay_message.recipients {
            conversation
                .exchange(Some(&format!("RCPT TO:<{recipient}>")), &[250, 251])
                .await?;
        }
        let final_reply = conversation
            .send_message_data(relay_message.raw_message)
            .await?;
        let _ = conversation.exchange(Some("QUIT"), &[221]).await;
        Ok(final_reply)
    }
}

async fn authenticate(
    conversation: &mut RelayConversation,
    credentials: &RelayCredentials,
) -> Result<(), String> {
    let plain_login = encode_base64_text(&format!(
        "\0{}\0{}",
        credentials.user_name, credentials.password
    ));
    conversation
        .exchange(Some(&format!("AUTH PLAIN {plain_login}")), &[235])
        .await
        .map(|_| ())
        .map_err(|refusal| format!("the relay refused the login: {refusal}"))
}

impl EmailRelay for RelaySmtpClient {
    fn relay_message<'relay>(
        &'relay self,
        relay_message: RelayMessage<'relay>,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + 'relay>> {
        Box::pin(async move {
            tokio::time::timeout(RELAY_TIMEOUT, self.deliver(relay_message))
                .await
                .map_err(|_| "the relay did not answer in time".to_owned())?
        })
    }
}
