use std::sync::Arc;
use std::time::Duration;

use tokio::net::TcpListener;
use tokio::sync::watch;
use tokio::task::JoinSet;

use super::connection_handler::handle_connection;
use super::operations_mailbox::OperationsMailbox;
use crate::protocol::Pop3Login;

/// How long sessions in progress may take to finish after a shutdown signal.
const SHUTDOWN_GRACE_PERIOD: Duration = Duration::from_secs(10);

/// What every POP3 connection shares: who may sign in and where the mail comes from.
pub struct Pop3Server {
    pub login: Pop3Login,
    pub mailbox: OperationsMailbox,
}

/// Accepts connections until the shutdown signal, then lets sessions finish for up to the
/// grace period, as the SMTP listener does.
pub async fn serve_pop3(
    listener: TcpListener,
    pop3_server: Arc<Pop3Server>,
    mut shutdown_requested: watch::Receiver<bool>,
) {
    let mut sessions = JoinSet::new();
    loop {
        tokio::select! {
            accepted = listener.accept() => match accepted {
                Ok((tcp_stream, _)) => {
                    sessions.spawn(handle_connection(tcp_stream, Arc::clone(&pop3_server)));
                }
                Err(accept_error) => tracing::warn!(error = %accept_error, "could not accept a POP3 connection"),
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
