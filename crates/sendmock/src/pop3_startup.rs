use std::sync::Arc;

use sendmock_ops::OperationContext;
use sendmock_pop3::{OperationsMailbox, Pop3Server, serve_pop3};
use tokio::net::TcpListener;
use tokio::sync::watch;

use crate::config::{Pop3Config, ServerConfig};
use crate::listener_binding::bind_listener;
use crate::startup_error::StartupError;

/// The POP3 listener when `--pop3-addr` is set, bound with the others so a busy port stops
/// startup.
pub async fn bind_pop3_listener(
    server_config: &ServerConfig,
) -> Result<Option<TcpListener>, StartupError> {
    match &server_config.pop3 {
        Some(pop3_config) => Ok(Some(
            bind_listener(pop3_config.pop3_addr, "--pop3-addr").await?,
        )),
        None => Ok(None),
    }
}

/// The POP3 listener's task: it serves until the shutdown signal, reading mail through
/// SendMock's operations.
pub fn serve_pop3_listener(
    pop3_listener: TcpListener,
    pop3_config: &Pop3Config,
    operation_context: &OperationContext,
    shutdown_receiver: watch::Receiver<bool>,
) -> impl Future<Output = ()> + Send + 'static {
    let pop3_server = Arc::new(Pop3Server {
        login: pop3_config.login.clone(),
        mailbox: OperationsMailbox::new(operation_context.clone()),
    });
    serve_pop3(pop3_listener, pop3_server, shutdown_receiver)
}
