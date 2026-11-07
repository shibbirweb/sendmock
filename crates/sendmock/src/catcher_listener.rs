use std::net::SocketAddr;

use sendmock_api::{build_catch_all_router, serve_http};
use sendmock_ops::OperationContext;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tokio::task::JoinSet;

/// Serves `--catcher-addr` until the shutdown signal: every request is captured in the HTTP
/// catcher, the first path segment naming the bin (HC-01.4).
pub fn start_catcher_listener(
    background_tasks: &mut JoinSet<()>,
    catcher_listener: TcpListener,
    catcher_addr: SocketAddr,
    operation_context: &OperationContext,
    shutdown_receiver: &watch::Receiver<bool>,
) {
    let catch_all_router = build_catch_all_router(operation_context);
    let mut listener_shutdown = shutdown_receiver.clone();
    background_tasks.spawn(async move {
        let shutdown_signal = async move {
            let _ = listener_shutdown.wait_for(|is_stopping| *is_stopping).await;
        };
        if let Err(serve_error) = serve_http(catcher_listener, catch_all_router, shutdown_signal).await
        {
            tracing::error!(catcher_addr = %catcher_addr, error = %serve_error, "catcher listener stopped");
        }
    });
}
