use std::net::SocketAddr;
use std::sync::Arc;

use sendmock_api::{EmbeddedUiAssets, build_app_router, serve_http};
use sendmock_core::{Clock, SystemClock, SystemIdGenerator};
use sendmock_ops::{OperationContext, build_operation_registry};
use sendmock_smtp::serve_smtp;
use sendmock_store::Database;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tokio::task::JoinSet;

use crate::config::ServerConfig;
use crate::instance_details_builder::build_instance_details;
use crate::listener_binding::bind_listener;
use crate::retention_task::{apply_retention_flags, run_retention_task};
use crate::shutdown_signal::ShutdownSignal;
use crate::smtp_startup::build_smtp_server;
use crate::startup_error::StartupError;

/// Every listener, bound before anything is announced so a busy port stops startup.
struct BoundListeners {
    http_listener: TcpListener,
    http_addr: SocketAddr,
    smtp_listener: TcpListener,
    smtp_addr: SocketAddr,
    smtps_listener: Option<TcpListener>,
}

pub async fn run_server(
    server_config: &ServerConfig,
    database: Database,
) -> Result<(), StartupError> {
    let listeners = bind_listeners(server_config).await?;
    let clock: Arc<dyn Clock> = Arc::new(SystemClock);
    let started_at_unix_ms = clock.now_unix_ms();
    let operation_context = OperationContext::new(
        Arc::new(database),
        clock,
        Arc::new(SystemIdGenerator),
        build_instance_details(listeners.http_addr, listeners.smtp_addr, started_at_unix_ms),
    );
    let app_router = build_app_router(
        &build_operation_registry(),
        &operation_context,
        Arc::new(EmbeddedUiAssets),
    );
    let (shutdown_sender, shutdown_receiver) = watch::channel(false);
    let shutdown_receiver_for_retention = shutdown_receiver.clone();
    let mut background_tasks = start_smtp_listeners(
        server_config,
        &operation_context,
        listeners.smtp_listener,
        listeners.smtps_listener,
        shutdown_receiver,
    )?;
    apply_retention_flags(server_config, &operation_context).await;
    let shutdown_signal = ShutdownSignal::install().map_err(StartupError::Runtime)?;
    background_tasks.spawn(run_retention_task(
        operation_context.clone(),
        shutdown_receiver_for_retention,
    ));
    announce_ready(
        server_config,
        &listeners.http_addr,
        &listeners.smtp_addr,
        &operation_context,
    );
    let http_shutdown = async move {
        shutdown_signal.wait().await;
        let _ = shutdown_sender.send(true);
    };
    serve_http(listeners.http_listener, app_router, http_shutdown)
        .await
        .map_err(|source| StartupError::Listen {
            address: listeners.http_addr,
            source,
        })?;
    while background_tasks.join_next().await.is_some() {}
    tracing::info!("SendMock stopped");
    Ok(())
}

/// The SMTP listener, and the SMTPS one when configured, each stopping on the shutdown signal.
fn start_smtp_listeners(
    server_config: &ServerConfig,
    operation_context: &OperationContext,
    smtp_listener: TcpListener,
    smtps_listener: Option<TcpListener>,
    shutdown_receiver: watch::Receiver<bool>,
) -> Result<JoinSet<()>, StartupError> {
    let smtp_server = build_smtp_server(server_config, operation_context.clone())?;
    let mut smtp_listeners = JoinSet::new();
    smtp_listeners.spawn(serve_smtp(
        smtp_listener,
        Arc::clone(&smtp_server),
        false,
        shutdown_receiver.clone(),
    ));
    if let Some(smtps_listener) = smtps_listener {
        smtp_listeners.spawn(serve_smtp(
            smtps_listener,
            smtp_server,
            true,
            shutdown_receiver,
        ));
    }
    Ok(smtp_listeners)
}

async fn bind_listeners(server_config: &ServerConfig) -> Result<BoundListeners, StartupError> {
    let http_listener = bind_listener(server_config.http_addr, "--http-addr").await?;
    let smtp_listener = bind_listener(server_config.smtp_addr, "--smtp-addr").await?;
    let smtps_listener = match server_config.smtp.smtps_addr {
        Some(smtps_addr) => Some(bind_listener(smtps_addr, "--smtps-addr").await?),
        None => None,
    };
    let local_address = |listener: &TcpListener, configured_address: SocketAddr| {
        listener
            .local_addr()
            .map_err(|source| StartupError::Listen {
                address: configured_address,
                source,
            })
    };
    Ok(BoundListeners {
        http_addr: local_address(&http_listener, server_config.http_addr)?,
        smtp_addr: local_address(&smtp_listener, server_config.smtp_addr)?,
        http_listener,
        smtp_listener,
        smtps_listener,
    })
}

fn announce_ready(
    server_config: &ServerConfig,
    http_addr: &SocketAddr,
    smtp_addr: &SocketAddr,
    operation_context: &OperationContext,
) {
    if !http_addr.ip().is_loopback() {
        tracing::warn!(
            http_addr = %http_addr,
            "SendMock is listening beyond this machine without UI auth; anyone who can reach this port can read what it captured"
        );
    }
    tracing::info!(
        http_addr = %http_addr,
        smtp_addr = %smtp_addr,
        smtps_addr = ?server_config.smtp.smtps_addr,
        database = %operation_context.database.location(),
        config_file = ?server_config.config_file_path,
        "SendMock is ready"
    );
}
