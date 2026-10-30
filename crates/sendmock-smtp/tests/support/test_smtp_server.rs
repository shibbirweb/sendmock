use std::io;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use sendmock_core::{SystemClock, SystemIdGenerator};
use sendmock_ops::{InstanceDetails, OperationContext, ReleaseChannel};
use sendmock_smtp::{
    RecipientPolicy, SessionSettings, SmtpAuthMode, SmtpServer, TlsAcceptor, TlsCertificateSource,
    build_tls_server_config, read_generated_certificate, serve_smtp,
};
use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, EmailListFilter, EmailRecord,
    SmtpSessionFilter, SmtpSessionRecord,
};
use tokio::net::TcpListener;
use tokio::sync::watch;

const SESSION_LOG_TIMEOUT: Duration = Duration::from_secs(5);

pub struct TestServerOptions {
    pub max_size_bytes: u64,
    pub auth_mode: SmtpAuthMode,
    pub certificate_files: Option<(PathBuf, PathBuf)>,
}

impl Default for TestServerOptions {
    fn default() -> Self {
        Self {
            max_size_bytes: 1024 * 1024,
            auth_mode: SmtpAuthMode::AcceptAny,
            certificate_files: None,
        }
    }
}

/// An SMTP and an SMTPS listener on free ports over an in-memory database, stopped on drop.
pub struct TestSmtpServer {
    pub smtp_addr: SocketAddr,
    pub smtps_addr: SocketAddr,
    pub operation_context: OperationContext,
    pub generated_folder: tempfile::TempDir,
    shutdown_sender: watch::Sender<bool>,
}

impl TestSmtpServer {
    pub async fn start() -> io::Result<Self> {
        Self::start_with(TestServerOptions::default()).await
    }

    pub async fn start_with(options: TestServerOptions) -> io::Result<Self> {
        let generated_folder = tempfile::tempdir()?;
        let operation_context = build_operation_context()?;
        let smtp_server =
            build_smtp_server(options, generated_folder.path(), operation_context.clone())?;
        let (shutdown_sender, shutdown_receiver) = watch::channel(false);
        let smtp_listener = TcpListener::bind("127.0.0.1:0").await?;
        let smtps_listener = TcpListener::bind("127.0.0.1:0").await?;
        let smtp_addr = smtp_listener.local_addr()?;
        let smtps_addr = smtps_listener.local_addr()?;
        tokio::spawn(serve_smtp(
            smtp_listener,
            Arc::clone(&smtp_server),
            false,
            shutdown_receiver.clone(),
        ));
        tokio::spawn(serve_smtp(
            smtps_listener,
            smtp_server,
            true,
            shutdown_receiver,
        ));
        Ok(Self {
            smtp_addr,
            smtps_addr,
            operation_context,
            generated_folder,
            shutdown_sender,
        })
    }

    pub fn generated_certificate_pem(&self) -> io::Result<String> {
        read_generated_certificate(self.generated_folder.path())
            .ok_or_else(|| io::Error::other("no generated certificate"))
    }

    pub async fn list_emails(&self) -> io::Result<Vec<EmailRecord>> {
        Ok(self
            .operation_context
            .email_repository
            .list_emails(EmailListFilter::default(), None, 1000)
            .await
            .map_err(io::Error::other)?
            .emails)
    }

    /// Sessions are recorded when their connection closes, so this waits for them.
    pub async fn wait_for_sessions(
        &self,
        expected_count: usize,
    ) -> io::Result<Vec<SmtpSessionRecord>> {
        let deadline = Instant::now() + SESSION_LOG_TIMEOUT;
        loop {
            let sessions = self
                .operation_context
                .smtp_session_repository
                .list_sessions(SmtpSessionFilter::default(), None, 1000)
                .await
                .map_err(io::Error::other)?
                .sessions;
            if sessions.len() >= expected_count || Instant::now() > deadline {
                return Ok(sessions);
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    }
}

fn build_smtp_server(
    options: TestServerOptions,
    generated_folder: &Path,
    operation_context: OperationContext,
) -> io::Result<Arc<SmtpServer>> {
    let tls_server_config = build_tls_server_config(&TlsCertificateSource {
        certificate_file: options
            .certificate_files
            .as_ref()
            .map(|files| files.0.as_path()),
        key_file: options
            .certificate_files
            .as_ref()
            .map(|files| files.1.as_path()),
        generated_folder: Some(generated_folder),
        hostname: "localhost",
    })
    .map_err(io::Error::other)?;
    Ok(Arc::new(SmtpServer {
        session_settings: Arc::new(SessionSettings {
            hostname: "localhost".to_owned(),
            max_size_bytes: options.max_size_bytes,
            auth_mode: options.auth_mode,
            is_tls_available: true,
            is_tls_required: false,
            recipient_policy: RecipientPolicy::default(),
        }),
        tls_acceptor: Some(TlsAcceptor::from(tls_server_config)),
        operation_context,
    }))
}

impl Drop for TestSmtpServer {
    fn drop(&mut self) {
        let _ = self.shutdown_sender.send(true);
    }
}

fn build_operation_context() -> io::Result<OperationContext> {
    let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
        .map_err(io::Error::other)?;
    Ok(OperationContext::new(
        Arc::new(database),
        Arc::new(SystemClock),
        Arc::new(SystemIdGenerator),
        InstanceDetails {
            version: "0.1.0",
            channel: ReleaseChannel::Dev,
            started_at_unix_ms: 0,
            http_address: "127.0.0.1:8025".to_owned(),
            smtp_address: "127.0.0.1:1025".to_owned(),
            provider_address: None,
            is_container: false,
        },
    ))
}
