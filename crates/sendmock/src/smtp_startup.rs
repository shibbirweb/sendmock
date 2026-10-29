use std::sync::Arc;

use sendmock_ops::OperationContext;
use sendmock_smtp::{
    SessionSettings, SmtpServer, TlsAcceptor, TlsCertificateSource, build_tls_server_config,
};

use crate::config::ServerConfig;
use crate::startup_error::StartupError;

/// The name SendMock gives itself in SMTP greetings and the generated certificate.
const SMTP_HOSTNAME: &str = "localhost";

/// The SMTP server every listener shares. STARTTLS is always offered, with the user's
/// certificate or one generated on first run.
pub fn build_smtp_server(
    server_config: &ServerConfig,
    operation_context: OperationContext,
) -> Result<Arc<SmtpServer>, StartupError> {
    let smtp_config = &server_config.smtp;
    let generated_files_folder = server_config.generated_files_folder();
    let tls_server_config = build_tls_server_config(&TlsCertificateSource {
        certificate_file: smtp_config.tls_certificate_file.as_deref(),
        key_file: smtp_config.tls_key_file.as_deref(),
        generated_folder: generated_files_folder.as_deref(),
        hostname: SMTP_HOSTNAME,
    })?;
    let session_settings = SessionSettings {
        hostname: SMTP_HOSTNAME.to_owned(),
        max_size_bytes: smtp_config.max_size_bytes,
        auth_mode: smtp_config.auth_mode.clone(),
        is_tls_available: true,
        is_tls_required: smtp_config.is_tls_required,
        recipient_policy: smtp_config.recipient_policy.clone(),
    };
    Ok(Arc::new(SmtpServer {
        session_settings: Arc::new(session_settings),
        tls_acceptor: Some(TlsAcceptor::from(tls_server_config)),
        operation_context,
    }))
}
