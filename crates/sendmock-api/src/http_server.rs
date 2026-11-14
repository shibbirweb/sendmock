use std::future::Future;
use std::io;
use std::time::Duration;

use axum::Router;
use tokio::net::TcpListener;
use tokio::sync::watch;

/// How long requests already in flight may take to finish after a shutdown signal.
pub const SHUTDOWN_GRACE_PERIOD: Duration = Duration::from_secs(10);

/// Serves until `shutdown_signal` resolves, then stops taking connections and lets
/// in-flight requests finish for up to the grace period.
pub async fn serve_http(
    listener: TcpListener,
    app_router: Router,
    shutdown_signal: impl Future<Output = ()> + Send + 'static,
) -> io::Result<()> {
    let (shutdown_requested_sender, mut shutdown_requested_receiver) = watch::channel(false);
    let graceful_shutdown = async move {
        let _ = shutdown_requested_receiver
            .wait_for(|is_requested| *is_requested)
            .await;
    };
    let server = axum::serve(listener, app_router).with_graceful_shutdown(graceful_shutdown);
    let grace_period_after_signal = async move {
        shutdown_signal.await;
        let _ = shutdown_requested_sender.send(true);
        tokio::time::sleep(SHUTDOWN_GRACE_PERIOD).await;
    };
    tokio::select! {
        server_result = server => server_result,
        () = grace_period_after_signal => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;
    use tokio::sync::oneshot;

    use super::*;
    use crate::app_router::build_app_router;
    use crate::test_support::{build_test_operation_context, build_test_operation_registry};
    use crate::ui_assets::InMemoryUiAssets;

    async fn send_raw_get(address: std::net::SocketAddr, path: &str) -> io::Result<String> {
        let mut stream = TcpStream::connect(address).await?;
        stream
            .write_all(
                format!("GET {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
                    .as_bytes(),
            )
            .await?;
        let mut response = String::new();
        stream.read_to_string(&mut response).await?;
        Ok(response)
    }

    #[tokio::test]
    async fn lets_a_request_in_flight_finish_after_the_shutdown_signal() -> io::Result<()> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let address = listener.local_addr()?;
        let app_router = build_app_router(
            &build_test_operation_registry(),
            &build_test_operation_context(),
            Arc::new(InMemoryUiAssets::default()),
        );
        let (shutdown_sender, shutdown_receiver) = oneshot::channel::<()>();
        let server = tokio::spawn(serve_http(listener, app_router, async move {
            let _ = shutdown_receiver.await;
        }));

        let slow_request = tokio::spawn(send_raw_get(address, "/api/v1/test/slow"));
        tokio::time::sleep(Duration::from_millis(100)).await;
        let _ = shutdown_sender.send(());
        let response = slow_request.await.map_err(io::Error::other)??;

        assert!(response.starts_with("HTTP/1.1 200"));
        assert!(response.contains("finished"));
        server.await.map_err(io::Error::other)??;
        Ok(())
    }
}
