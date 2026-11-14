use std::io::ErrorKind;
use std::net::SocketAddr;

use tokio::net::TcpListener;

use crate::startup_error::StartupError;

/// Suggested instead of a busy port: 8025 becomes 8125, the next free-looking hundred.
const SUGGESTED_PORT_OFFSET: u16 = 100;

pub async fn bind_listener(
    address: SocketAddr,
    flag_name: &'static str,
) -> Result<TcpListener, StartupError> {
    TcpListener::bind(address).await.map_err(|source| {
        if source.kind() == ErrorKind::AddrInUse {
            StartupError::PortInUse {
                address,
                flag_name,
                suggested_addr: SocketAddr::new(
                    address.ip(),
                    address.port().saturating_add(SUGGESTED_PORT_OFFSET),
                ),
            }
        } else {
            StartupError::Listen { address, source }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-07.3
    #[tokio::test]
    async fn a_busy_port_names_the_flag_and_a_free_looking_port() -> std::io::Result<()> {
        let busy_listener = TcpListener::bind("127.0.0.1:0").await?;
        let busy_address = busy_listener.local_addr()?;

        let bind_result = bind_listener(busy_address, "--http-addr").await;

        let error_message = bind_result
            .err()
            .map(|startup_error| startup_error.to_string())
            .unwrap_or_default();
        assert!(error_message.contains(&format!("Port {} is in use", busy_address.port())));
        assert!(error_message.contains("--http-addr"));
        Ok(())
    }

    #[tokio::test]
    async fn binds_a_free_port() -> std::io::Result<()> {
        let listener = bind_listener(
            "127.0.0.1:0".parse().map_err(std::io::Error::other)?,
            "--http-addr",
        )
        .await;

        assert!(listener.is_ok());
        Ok(())
    }
}
