use std::sync::Arc;

use sendmock_api::{EmbeddedUiAssets, build_app_router, serve_http};
use sendmock_core::{Clock, SystemClock};
use sendmock_ops::{OperationContext, build_operation_registry};
use sendmock_store::Database;

use crate::config::ServerConfig;
use crate::instance_details_builder::build_instance_details;
use crate::listener_binding::bind_listener;
use crate::shutdown_signal::wait_for_shutdown_signal;
use crate::startup_error::StartupError;

pub async fn run_server(
    server_config: &ServerConfig,
    database: Database,
) -> Result<(), StartupError> {
    let http_listener = bind_listener(server_config.http_addr, "--http-addr").await?;
    let listen_error = |source| StartupError::Listen {
        address: server_config.http_addr,
        source,
    };
    let http_addr = http_listener.local_addr().map_err(listen_error)?;
    let clock: Arc<dyn Clock> = Arc::new(SystemClock);
    let operation_context = OperationContext {
        database: Arc::new(database),
        instance_details: Arc::new(build_instance_details(
            server_config,
            http_addr,
            clock.now_unix_ms(),
        )),
        clock,
    };
    let app_router = build_app_router(
        &build_operation_registry(),
        &operation_context,
        Arc::new(EmbeddedUiAssets),
    );
    if !http_addr.ip().is_loopback() {
        tracing::warn!(
            http_addr = %http_addr,
            "SendMock is listening beyond this machine without UI auth; anyone who can reach this port can read what it captured"
        );
    }
    tracing::info!(
        http_addr = %http_addr,
        database = %operation_context.database.location(),
        config_file = ?server_config.config_file_path,
        "SendMock is ready"
    );
    serve_http(http_listener, app_router, wait_for_shutdown_signal())
        .await
        .map_err(listen_error)?;
    tracing::info!("SendMock stopped");
    Ok(())
}
