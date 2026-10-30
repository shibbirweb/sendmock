use std::sync::Arc;
use std::time::Duration;

use sendmock_ops::OperationContext;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tokio::task::JoinSet;
use tokio_rustls::TlsAcceptor;

use super::connection_handler::handle_connection;
use crate::SessionSettings;

/// How long sessions in progress may take to finish after a shutdown signal.
const SHUTDOWN_GRACE_PERIOD: Duration = Duration::from_secs(10);

/// What every connection shares: the session settings, TLS and where messages go.
pub struct SmtpServer {
    pub session_settings: Arc<SessionSettings>,
    pub tls_acceptor: Option<TlsAcceptor>,
    pub operation_context: OperationContext,
}

/// Accepts connections until the shutdown signal, then lets sessions finish for up to the
/// grace period. `is_implicit_tls` makes it the SMTPS listener (TLS from the first byte).
pub async fn serve_smtp(
    listener: TcpListener,
    smtp_server: Arc<SmtpServer>,
    is_implicit_tls: bool,
    mut shutdown_requested: watch::Receiver<bool>,
) {
    let mut sessions = JoinSet::new();
    loop {
        tokio::select! {
            accepted = listener.accept() => match accepted {
                Ok((tcp_stream, remote_address)) => {
                    sessions.spawn(handle_connection(tcp_stream, remote_address, Arc::clone(&smtp_server), is_implicit_tls));
                }
                Err(accept_error) => tracing::warn!(error = %accept_error, "could not accept an SMTP connection"),
            },
            _ = shutdown_requested.wait_for(|is_requested| *is_requested) => break,
            Some(_) = sessions.join_next(), if !sessions.is_empty() => {}
        }
    }
    drop(listener);
    let _ = tokio::time::timeout(SHUTDOWN_GRACE_PERIOD, async {
        while sessions.join_next().await.is_some() {}
    })
    .await;
}
