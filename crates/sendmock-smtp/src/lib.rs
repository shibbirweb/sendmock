//! The SMTP listener, which hands each received message to an operation.

mod client;
mod protocol;
mod server;

pub use client::LoopbackSmtpClient;
pub use protocol::{
    MessageEnvelope, RecipientPolicy, SessionAction, SessionResult, SessionSettings, SmtpAuthMode,
    SmtpAuthModeError, SmtpReply, SmtpSession, cram_md5_digest, encode_base64_text,
};
pub use server::{
    SmtpServer, TlsCertificateSource, TlsSetupError, build_tls_server_config,
    read_generated_certificate, serve_smtp,
};
pub use tokio_rustls::TlsAcceptor;
