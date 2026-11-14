use std::net::SocketAddr;

use sendmock_api::{build_provider_port_router, serve_http};
use sendmock_ops::OperationContext;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tokio::task::JoinSet;

use crate::config::ProviderPortConfig;
use crate::listener_binding::bind_listener;
use crate::startup_error::StartupError;

/// A bound provider listener and the provider it is dedicated to, if any.
pub struct ProviderListener {
    listener: TcpListener,
    dedicated_provider_key: Option<String>,
    pub bound_addr: SocketAddr,
}

impl ProviderListener {
    /// The listener for every provider, not one provider's own port.
    pub fn is_shared(&self) -> bool {
        self.dedicated_provider_key.is_none()
    }
}

/// Binds the provider address and each dedicated provider port, before anything is announced.
pub async fn bind_provider_listeners(
    provider_ports: &ProviderPortConfig,
) -> Result<Vec<ProviderListener>, StartupError> {
    let mut provider_listeners = Vec::new();
    let wanted_listeners = provider_ports
        .provider_addr
        .map(|provider_addr| (None, provider_addr, "--provider-addr"))
        .into_iter()
        .chain(
            provider_ports
                .dedicated_ports
                .iter()
                .map(|(provider_key, port_addr)| {
                    (Some(provider_key.clone()), *port_addr, "--provider-port")
                }),
        );
    for (dedicated_provider_key, configured_addr, flag_name) in wanted_listeners {
        let listener = bind_listener(configured_addr, flag_name).await?;
        let bound_addr = listener
            .local_addr()
            .map_err(|source| StartupError::Listen {
                address: configured_addr,
                source,
            })?;
        provider_listeners.push(ProviderListener {
            listener,
            dedicated_provider_key,
            bound_addr,
        });
    }
    Ok(provider_listeners)
}

/// Serves each provider listener until the shutdown signal.
pub fn start_provider_listeners(
    background_tasks: &mut JoinSet<()>,
    provider_listeners: Vec<ProviderListener>,
    operation_context: &OperationContext,
    shutdown_receiver: &watch::Receiver<bool>,
) {
    for provider_listener in provider_listeners {
        let provider_router =
            build_provider_port_router(operation_context, provider_listener.dedicated_provider_key);
        let mut listener_shutdown = shutdown_receiver.clone();
        let bound_addr = provider_listener.bound_addr;
        background_tasks.spawn(async move {
            let shutdown_signal = async move {
                let _ = listener_shutdown.wait_for(|is_stopping| *is_stopping).await;
            };
            if let Err(serve_error) =
                serve_http(provider_listener.listener, provider_router, shutdown_signal).await
            {
                tracing::error!(provider_addr = %bound_addr, error = %serve_error, "provider listener stopped");
            }
        });
    }
}
