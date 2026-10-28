/// Resolves on Ctrl-C, or on `SIGTERM` (what `docker stop` sends) on Unix.
pub async fn wait_for_shutdown_signal() {
    let interrupt = async {
        if tokio::signal::ctrl_c().await.is_err() {
            std::future::pending::<()>().await;
        }
    };
    tokio::select! {
        () = interrupt => {}
        () = wait_for_terminate_signal() => {}
    }
}

#[cfg(unix)]
async fn wait_for_terminate_signal() {
    use tokio::signal::unix::{SignalKind, signal};

    match signal(SignalKind::terminate()) {
        Ok(mut terminate_signal) => {
            terminate_signal.recv().await;
        }
        Err(_) => std::future::pending::<()>().await,
    }
}

#[cfg(not(unix))]
async fn wait_for_terminate_signal() {
    std::future::pending::<()>().await;
}
