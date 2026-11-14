#[cfg(test)]
use std::net::Ipv6Addr;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;

use clap::Parser;
use tokio::net::TcpStream;
use tokio::task::JoinHandle;
use tokio::time::Instant;

use crate::cli_arguments::ServeArguments;
use crate::server_runner::run_server;
use crate::server_startup::prepare_server;
use crate::startup_error::StartupError;

const CONNECT_ATTEMPT_TIMEOUT: Duration = Duration::from_millis(500);
const STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
const STARTUP_POLL_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Debug, thiserror::Error)]
pub enum EmbeddedServerError {
    #[error(
        "--embedded starts a server only at a local address such as http://127.0.0.1:8025, not {server_url}"
    )]
    NotLocalAddress { server_url: String },

    #[error("{0}")]
    Settings(#[from] clap::Error),

    #[error(transparent)]
    Startup(#[from] StartupError),

    #[error("The embedded server stopped while starting")]
    StoppedWhileStarting,

    #[error(
        "The embedded server did not listen at {http_addr} within {} seconds",
        STARTUP_TIMEOUT.as_secs()
    )]
    NotListening { http_addr: SocketAddr },
}

/// The server's settings from the `SENDMOCK_*` variables and `sendmock.toml` only, as
/// `sendmock serve` reads them when given no flags.
#[derive(Parser)]
struct EmbeddedServeSettings {
    #[command(flatten)]
    serve_arguments: ServeArguments,
}

/// The server `sendmock serve` runs, started inside `sendmock mcp --embedded`.
pub struct EmbeddedServer {
    server_task: JoinHandle<Result<(), StartupError>>,
}

impl EmbeddedServer {
    /// Starts a server at `server_url` when nothing answers there, and answers `None` when
    /// a server already does. The server runs on the current runtime.
    pub async fn start_unless_running(
        server_url: &str,
    ) -> Result<Option<Self>, EmbeddedServerError> {
        let http_addr = parse_local_http_addr(server_url).ok_or_else(|| {
            EmbeddedServerError::NotLocalAddress {
                server_url: server_url.to_owned(),
            }
        })?;
        if accepts_connections(http_addr).await {
            return Ok(None);
        }
        let mut serve_arguments =
            EmbeddedServeSettings::try_parse_from(["sendmock"])?.serve_arguments;
        serve_arguments.http_addr = Some(http_addr);
        // Stdout carries the MCP messages, so nothing else may be printed there.
        serve_arguments.ready_json = false;
        let (server_config, database) = prepare_server(&serve_arguments, true)?;
        tracing::info!(%http_addr, "No SendMock answered, so one runs inside this MCP server");
        let server_task = tokio::spawn(async move { run_server(&server_config, database).await });
        wait_until_listening(http_addr, &server_task).await?;
        Ok(Some(Self { server_task }))
    }

    /// Resolves when the server stops, on Ctrl+C or a termination signal.
    pub async fn wait_until_stopped(self) {
        match self.server_task.await {
            Ok(Err(startup_error)) => {
                tracing::error!("The embedded server stopped: {startup_error}")
            }
            Ok(Ok(())) => {}
            Err(join_error) => tracing::error!("The embedded server stopped: {join_error}"),
        }
    }
}

async fn wait_until_listening(
    http_addr: SocketAddr,
    server_task: &JoinHandle<Result<(), StartupError>>,
) -> Result<(), EmbeddedServerError> {
    let deadline = Instant::now() + STARTUP_TIMEOUT;
    while Instant::now() < deadline {
        if server_task.is_finished() {
            return Err(EmbeddedServerError::StoppedWhileStarting);
        }
        if accepts_connections(http_addr).await {
            return Ok(());
        }
        tokio::time::sleep(STARTUP_POLL_INTERVAL).await;
    }
    Err(EmbeddedServerError::NotListening { http_addr })
}

async fn accepts_connections(http_addr: SocketAddr) -> bool {
    matches!(
        tokio::time::timeout(CONNECT_ATTEMPT_TIMEOUT, TcpStream::connect(http_addr)).await,
        Ok(Ok(_))
    )
}

/// The listen address for an `http://host:port` URL on this machine; `localhost` is
/// `127.0.0.1`. Any other URL answers `None`.
fn parse_local_http_addr(server_url: &str) -> Option<SocketAddr> {
    let authority = server_url.strip_prefix("http://")?.split('/').next()?;
    let (host, port) = authority.rsplit_once(':')?;
    let port = port.parse::<u16>().ok()?;
    let host_ip = match host.trim_start_matches('[').trim_end_matches(']') {
        "localhost" => IpAddr::V4(Ipv4Addr::LOCALHOST),
        other_host => other_host.parse::<IpAddr>().ok()?,
    };
    host_ip
        .is_loopback()
        .then_some(SocketAddr::new(host_ip, port))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_loopback_address_and_localhost() {
        assert_eq!(
            parse_local_http_addr("http://127.0.0.1:8025"),
            Some(SocketAddr::from(([127, 0, 0, 1], 8025)))
        );
        assert_eq!(
            parse_local_http_addr("http://localhost:9000/"),
            Some(SocketAddr::from(([127, 0, 0, 1], 9000)))
        );
        assert_eq!(
            parse_local_http_addr("http://[::1]:8025"),
            Some(SocketAddr::new(IpAddr::V6(Ipv6Addr::LOCALHOST), 8025))
        );
    }

    #[test]
    fn refuses_other_hosts_https_and_urls_without_a_port() {
        assert_eq!(parse_local_http_addr("http://192.0.2.10:8025"), None);
        assert_eq!(parse_local_http_addr("http://sendmock:8025"), None);
        assert_eq!(parse_local_http_addr("https://127.0.0.1:8025"), None);
        assert_eq!(parse_local_http_addr("http://127.0.0.1"), None);
    }
}
