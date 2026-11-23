use std::net::SocketAddr;

use sendmock_api::{build_provider_port_router, serve_http};
use sendmock_ops::OperationContext;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tokio::task::JoinSet;

use crate::config::ProviderPortConfig;
use crate::listener_binding::bind_listener;
use crate::startup_error::StartupError;

const PROVIDER_ADDR_FLAG: &str = "--provider-addr";

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

async fn bind_provider_listener(
    configured_addr: SocketAddr,
    dedicated_provider_key: Option<String>,
    flag_name: &'static str,
) -> Result<ProviderListener, StartupError> {
    let listener = bind_listener(configured_addr, flag_name).await?;
    let bound_addr = listener
        .local_addr()
        .map_err(|source| StartupError::Listen {
            address: configured_addr,
            source,
        })?;
    Ok(ProviderListener {
        listener,
        dedicated_provider_key,
        bound_addr,
    })
}

/// The listener for every provider. A busy default port is not worth stopping for: SendMock
/// says so and starts without it, while an address someone set must bind or stop the start.
async fn bind_shared_provider_listener(
    provider_ports: &ProviderPortConfig,
) -> Result<Option<ProviderListener>, StartupError> {
    let Some(provider_addr) = provider_ports.provider_addr else {
        return Ok(None);
    };
    match bind_provider_listener(provider_addr, None, PROVIDER_ADDR_FLAG).await {
        Ok(provider_listener) => Ok(Some(provider_listener)),
        Err(StartupError::PortInUse { address, .. }) if provider_ports.is_default_provider_addr => {
            tracing::warn!(
                provider_addr = %address,
                "Port {} is in use, so SendMock starts without the provider port; free it, or set --provider-addr to another address (none turns it off)",
                address.port()
            );
            Ok(None)
        }
        Err(startup_error) => Err(startup_error),
    }
}

/// Binds the provider address and each dedicated provider port, before anything is announced.
pub async fn bind_provider_listeners(
    provider_ports: &ProviderPortConfig,
) -> Result<Vec<ProviderListener>, StartupError> {
    let mut provider_listeners: Vec<ProviderListener> =
        bind_shared_provider_listener(provider_ports)
            .await?
            .into_iter()
            .collect();
    for (provider_key, port_addr) in &provider_ports.dedicated_ports {
        provider_listeners.push(
            bind_provider_listener(*port_addr, Some(provider_key.clone()), "--provider-port")
                .await?,
        );
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

#[cfg(test)]
mod tests {
    use super::*;

    fn provider_ports_at(provider_addr: SocketAddr, is_default: bool) -> ProviderPortConfig {
        ProviderPortConfig {
            provider_addr: Some(provider_addr),
            is_default_provider_addr: is_default,
            ..ProviderPortConfig::default()
        }
    }

    // AC: PL-24.2
    #[tokio::test]
    async fn a_busy_default_port_starts_without_the_provider_port() -> std::io::Result<()> {
        let busy_listener = TcpListener::bind("127.0.0.1:0").await?;
        let busy_address = busy_listener.local_addr()?;

        let provider_listeners =
            bind_provider_listeners(&provider_ports_at(busy_address, true)).await;

        assert!(provider_listeners.is_ok_and(|listeners| listeners.is_empty()));
        Ok(())
    }

    // AC: PL-24.2
    #[tokio::test]
    async fn a_busy_port_someone_set_still_stops_the_start() -> std::io::Result<()> {
        let busy_listener = TcpListener::bind("127.0.0.1:0").await?;
        let busy_address = busy_listener.local_addr()?;

        let provider_listeners =
            bind_provider_listeners(&provider_ports_at(busy_address, false)).await;

        assert!(matches!(
            provider_listeners,
            Err(StartupError::PortInUse { .. })
        ));
        Ok(())
    }
}
