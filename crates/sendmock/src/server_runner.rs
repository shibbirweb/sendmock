use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::sync::Arc;

use sendmock_api::{EmbeddedUiAssets, apply_access_control, build_app_router, serve_http};
use sendmock_core::{Clock, SystemClock, SystemIdGenerator};
use sendmock_mcp::{
    InProcessOperationRunner, McpToolCatalog, SendmockMcpServer, ToolFilter, build_mcp_http_service,
};
use sendmock_ops::{OperationContext, build_operation_registry};
use sendmock_smtp::{SmtpSubmissionClient, serve_smtp};
use sendmock_store::Database;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tokio::task::JoinSet;

use crate::catcher_listener::start_catcher_listener;
use crate::config::ServerConfig;
use crate::email_network_clients::with_email_network_clients;
use crate::http_call_sender::{HttpCallSender, REPLY_WEBHOOK_TIMEOUT, STATUS_CALLBACK_TIMEOUT};
use crate::http_media_fetcher::HttpMediaFetcher;
use crate::http_webhook_sender::HttpWebhookSender;
use crate::instance_details_builder::build_instance_details;
use crate::listener_binding::bind_listener;
use crate::provider_listeners::{
    ProviderListener, bind_provider_listeners, start_provider_listeners,
};
use crate::retention_task::{apply_startup_settings, run_retention_task};
use crate::seed_file_check::apply_seed_file;
use crate::shutdown_signal::ShutdownSignal;
use crate::smtp_startup::build_smtp_server;
use crate::startup_error::StartupError;
use crate::template_directory_task::{load_file_templates, run_template_directory_task};
use crate::update_check_task::{build_update_checker, run_update_check_task};
use crate::webhook_dispatch_task::run_webhook_dispatch_task;

/// Where harnesses that prefer a URL reach the MCP server.
const MCP_HTTP_PATH: &str = "/mcp";

/// Every listener, bound before anything is announced so a busy port stops startup.
struct BoundListeners {
    http_listener: TcpListener,
    smtp_listener: TcpListener,
    smtps_listener: Option<TcpListener>,
    provider_listeners: Vec<ProviderListener>,
    catcher_listener: Option<TcpListener>,
    addresses: ListenerAddresses,
}

/// Where each listener ended up, port `0` resolved.
#[derive(Debug, Clone, Copy)]
struct ListenerAddresses {
    http_addr: SocketAddr,
    smtp_addr: SocketAddr,
    smtps_addr: Option<SocketAddr>,
    /// The listener serving every provider at its real paths, when configured.
    provider_addr: Option<SocketAddr>,
    /// The HTTP catcher's catch-all listener, when configured.
    catcher_addr: Option<SocketAddr>,
}

pub async fn run_server(
    server_config: &ServerConfig,
    database: Database,
) -> Result<(), StartupError> {
    let listeners = bind_listeners(server_config).await?;
    let operation_context = build_operation_context(database, &listeners);
    let app_router = build_http_router(server_config, &operation_context, &listeners.addresses);
    let (shutdown_sender, shutdown_receiver) = watch::channel(false);
    let shutdown_receiver_for_tasks = shutdown_receiver.clone();
    let shutdown_receiver_for_providers = shutdown_receiver.clone();
    let mut background_tasks = start_smtp_listeners(
        server_config,
        &operation_context,
        listeners.smtp_listener,
        listeners.smtps_listener,
        shutdown_receiver,
    )?;
    start_extra_http_listeners(
        &mut background_tasks,
        listeners.provider_listeners,
        listeners
            .catcher_listener
            .zip(listeners.addresses.catcher_addr),
        &operation_context,
        &shutdown_receiver_for_providers,
    );
    if let Some(seed_file_path) = &server_config.seed_file_path {
        apply_seed_file(seed_file_path, &operation_context).await?;
    }
    apply_startup_settings(server_config, &operation_context).await;
    let shutdown_signal = ShutdownSignal::install().map_err(StartupError::Runtime)?;
    spawn_background_tasks(
        &mut background_tasks,
        &operation_context,
        &shutdown_receiver_for_tasks,
        server_config.templates_directory.as_deref(),
    );
    announce_ready(server_config, &listeners.addresses, &operation_context);
    let http_shutdown = async move {
        shutdown_signal.wait().await;
        let _ = shutdown_sender.send(true);
    };
    serve_http(listeners.http_listener, app_router, http_shutdown)
        .await
        .map_err(|source| StartupError::Listen {
            address: listeners.addresses.http_addr,
            source,
        })?;
    while background_tasks.join_next().await.is_some() {}
    tracing::info!("SendMock stopped");
    Ok(())
}

/// The provider listeners and the catch-all catcher listener, each stopping on the shutdown signal.
fn start_extra_http_listeners(
    background_tasks: &mut JoinSet<()>,
    provider_listeners: Vec<ProviderListener>,
    catcher_listener: Option<(TcpListener, SocketAddr)>,
    operation_context: &OperationContext,
    shutdown_receiver: &watch::Receiver<bool>,
) {
    start_provider_listeners(
        background_tasks,
        provider_listeners,
        operation_context,
        shutdown_receiver,
    );
    if let Some((catcher_listener, catcher_addr)) = catcher_listener {
        start_catcher_listener(
            background_tasks,
            catcher_listener,
            catcher_addr,
            operation_context,
            shutdown_receiver,
        );
    }
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

/// The REST API, realtime streams and UI, MCP over HTTP at `/mcp`, and UI auth and CORS
/// around all of it.
fn build_http_router(
    server_config: &ServerConfig,
    operation_context: &OperationContext,
    addresses: &ListenerAddresses,
) -> axum::Router {
    let operation_registry = build_operation_registry();
    let mcp_tool_catalog = McpToolCatalog::new(
        &operation_registry,
        &ToolFilter::default(),
        Arc::new(InProcessOperationRunner::new(operation_context.clone())),
    );
    let mcp_http_service = build_mcp_http_service(
        SendmockMcpServer::new(mcp_tool_catalog, env!("CARGO_PKG_VERSION")),
        !addresses.http_addr.ip().is_loopback(),
    );
    let app_router = build_app_router(
        &operation_registry,
        operation_context,
        Arc::new(EmbeddedUiAssets),
    )
    .nest_service(MCP_HTTP_PATH, mcp_http_service);
    apply_access_control(app_router, server_config.access_control.clone())
}

/// The update check, the retention trim, the webhook dispatcher and the `--templates-dir`
/// reload (after a first load), each stopping on shutdown.
fn spawn_background_tasks(
    background_tasks: &mut JoinSet<()>,
    operation_context: &OperationContext,
    shutdown_receiver: &watch::Receiver<bool>,
    templates_directory: Option<&std::path::Path>,
) {
    if let Some(templates_directory) = templates_directory {
        load_file_templates(templates_directory, operation_context);
        background_tasks.spawn(run_template_directory_task(
            templates_directory.to_path_buf(),
            operation_context.clone(),
            shutdown_receiver.clone(),
        ));
    }
    background_tasks.spawn(run_update_check_task(
        operation_context.clone(),
        shutdown_receiver.clone(),
    ));
    background_tasks.spawn(run_retention_task(
        operation_context.clone(),
        shutdown_receiver.clone(),
    ));
    background_tasks.spawn(run_webhook_dispatch_task(
        operation_context.clone(),
        shutdown_receiver.clone(),
    ));
}

/// The context every operation runs with, able to send samples through the SMTP listener.
fn build_operation_context(database: Database, listeners: &BoundListeners) -> OperationContext {
    let clock: Arc<dyn Clock> = Arc::new(SystemClock);
    let started_at_unix_ms = clock.now_unix_ms();
    let operation_context = OperationContext::new(
        Arc::new(database),
        clock,
        Arc::new(SystemIdGenerator),
        build_instance_details(
            listeners.addresses.http_addr,
            listeners.addresses.smtp_addr,
            listeners.addresses.provider_addr,
            listeners.addresses.catcher_addr,
            started_at_unix_ms,
        ),
    )
    .with_sample_email_sender(Arc::new(SmtpSubmissionClient::new(reachable_address(
        listeners.addresses.smtp_addr,
    ))))
    .with_update_checker(build_update_checker());
    let operation_context = with_email_network_clients(operation_context);
    let operation_context = match HttpMediaFetcher::new() {
        Some(media_fetcher) => operation_context.with_media_fetcher(Arc::new(media_fetcher)),
        None => operation_context,
    };
    let operation_context = match HttpCallSender::new(STATUS_CALLBACK_TIMEOUT) {
        Some(callback_sender) => {
            operation_context.with_status_callback_sender(Arc::new(callback_sender))
        }
        None => operation_context,
    };
    let operation_context = match HttpCallSender::new(REPLY_WEBHOOK_TIMEOUT) {
        Some(reply_webhook_sender) => {
            operation_context.with_reply_webhook_sender(Arc::new(reply_webhook_sender))
        }
        None => operation_context,
    };
    match HttpWebhookSender::new() {
        Some(webhook_sender) => operation_context.with_webhook_sender(Arc::new(webhook_sender)),
        None => operation_context,
    }
}

/// The address to connect to a listener on; one bound to every interface is reached on loopback.
fn reachable_address(listen_address: SocketAddr) -> SocketAddr {
    match listen_address.ip() {
        IpAddr::V4(ipv4) if ipv4.is_unspecified() => {
            SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), listen_address.port())
        }
        IpAddr::V6(ipv6) if ipv6.is_unspecified() => {
            SocketAddr::new(IpAddr::V6(Ipv6Addr::LOCALHOST), listen_address.port())
        }
        _ => listen_address,
    }
}

async fn bind_listeners(server_config: &ServerConfig) -> Result<BoundListeners, StartupError> {
    let http_listener = bind_listener(server_config.http_addr, "--http-addr").await?;
    let smtp_listener = bind_listener(server_config.smtp_addr, "--smtp-addr").await?;
    let smtps_listener = match server_config.smtp.smtps_addr {
        Some(smtps_addr) => Some(bind_listener(smtps_addr, "--smtps-addr").await?),
        None => None,
    };
    let provider_listeners = bind_provider_listeners(&server_config.provider_ports).await?;
    let catcher_listener = match server_config.catcher_addr {
        Some(catcher_addr) => Some(bind_listener(catcher_addr, "--catcher-addr").await?),
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
    let addresses = ListenerAddresses {
        http_addr: local_address(&http_listener, server_config.http_addr)?,
        smtp_addr: local_address(&smtp_listener, server_config.smtp_addr)?,
        smtps_addr: smtps_listener
            .as_ref()
            .and_then(|listener| listener.local_addr().ok()),
        provider_addr: provider_listeners
            .iter()
            .find(|provider_listener| provider_listener.is_shared())
            .map(|provider_listener| provider_listener.bound_addr),
        catcher_addr: catcher_listener
            .as_ref()
            .and_then(|listener| listener.local_addr().ok()),
    };
    Ok(BoundListeners {
        http_listener,
        smtp_listener,
        smtps_listener,
        provider_listeners,
        catcher_listener,
        addresses,
    })
}

fn announce_ready(
    server_config: &ServerConfig,
    addresses: &ListenerAddresses,
    operation_context: &OperationContext,
) {
    let ListenerAddresses {
        http_addr,
        smtp_addr,
        smtps_addr,
        provider_addr,
        catcher_addr,
    } = addresses;
    if !http_addr.ip().is_loopback() && server_config.access_control.ui_auth.is_none() {
        tracing::warn!(
            http_addr = %http_addr,
            "SendMock is listening beyond this machine without UI auth; anyone who can reach this port can read what it captured"
        );
    }
    if server_config.prints_ready_json {
        let ready_line = serde_json::json!({
            "http_addr": http_addr.to_string(),
            "smtp_addr": smtp_addr.to_string(),
            "smtps_addr": smtps_addr.map(|smtps_addr| smtps_addr.to_string()),
            "provider_addr": provider_addr.map(|provider_addr| provider_addr.to_string()),
            "catcher_addr": catcher_addr.map(|catcher_addr| catcher_addr.to_string()),
            "version": env!("CARGO_PKG_VERSION"),
        });
        println!("{ready_line}");
    }
    tracing::info!(
        http_addr = %http_addr,
        smtp_addr = %smtp_addr,
        smtps_addr = ?smtps_addr,
        provider_addr = ?provider_addr,
        catcher_addr = ?catcher_addr,
        database = %operation_context.database.location(),
        config_file = ?server_config.config_file_path,
        "SendMock is ready"
    );
}
