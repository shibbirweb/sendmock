use std::io;
use std::net::SocketAddr;
use std::time::Duration;

use tokio::net::{TcpListener, TcpStream};
use tokio_rustls::TlsAcceptor;
use tokio_rustls::server::TlsStream;

/// A client that opens a connection and never finishes the handshake is dropped after this.
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);

/// The provider routes' listener over TLS: each accepted connection finishes its handshake
/// before axum serves it; a failed or stalled handshake is dropped and the next one accepted.
pub struct TlsProviderListener {
    pub tcp_listener: TcpListener,
    pub tls_acceptor: TlsAcceptor,
}

impl axum::serve::Listener for TlsProviderListener {
    type Io = TlsStream<TcpStream>;
    type Addr = SocketAddr;

    async fn accept(&mut self) -> (Self::Io, Self::Addr) {
        loop {
            let Ok((tcp_stream, remote_addr)) = self.tcp_listener.accept().await else {
                // Too many open files and the like pass; wait a moment before trying again.
                tokio::time::sleep(Duration::from_millis(50)).await;
                continue;
            };
            let handshake = self.tls_acceptor.accept(tcp_stream);
            if let Ok(Ok(tls_stream)) = tokio::time::timeout(HANDSHAKE_TIMEOUT, handshake).await {
                return (tls_stream, remote_addr);
            }
        }
    }

    fn local_addr(&self) -> io::Result<Self::Addr> {
        self.tcp_listener.local_addr()
    }
}
