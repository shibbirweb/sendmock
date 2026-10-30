mod connection_handler;
mod message_data_reader;
mod smtp_server;
mod tls_certificate;

pub use smtp_server::{SmtpServer, serve_smtp};
pub use tls_certificate::{
    TlsCertificateSource, TlsSetupError, build_tls_server_config, read_generated_certificate,
};
