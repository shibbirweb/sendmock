mod local_certificate_authority;
mod tls_provider_listener;

use std::net::SocketAddr;
use std::path::Path;
use std::sync::Arc;

use rustls::ServerConfig;
use rustls::pki_types::pem::PemObject;
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use sendmock_api::{build_provider_port_router, serve_http};
use sendmock_ops::{OperationContext, ProviderTlsDetails};
use tokio::sync::watch;
use tokio::task::JoinSet;
use tokio_rustls::TlsAcceptor;

use crate::config::ProviderTlsConfig;
use crate::listener_binding::bind_listener;
use crate::startup_error::StartupError;
pub use local_certificate_authority::{
    CA_COMMON_NAME, default_ca_folder, issue_server_certificate, load_local_ca_certificate,
};
use tls_provider_listener::TlsProviderListener;

/// The HTTPS provider listener, bound, with what `/api/v1/info` and `sendmock tls ca` report.
pub struct BoundTlsProviderListener {
    listener: TlsProviderListener,
    pub details: ProviderTlsDetails,
    pub bound_addr: SocketAddr,
}

fn tls_error(reason: impl ToString) -> StartupError {
    StartupError::ProviderTls(reason.to_string())
}

fn read_pem_file(file_path: &Path) -> Result<String, StartupError> {
    std::fs::read_to_string(file_path)
        .map_err(|read_error| tls_error(format!("{}: {read_error}", file_path.display())))
}

fn build_server_config(
    certificate_pem: &str,
    key_pem: &str,
) -> Result<Arc<ServerConfig>, StartupError> {
    let certificates = CertificateDer::pem_slice_iter(certificate_pem.as_bytes())
        .collect::<Result<Vec<_>, _>>()
        .map_err(tls_error)?;
    let private_key = PrivateKeyDer::from_pem_slice(key_pem.as_bytes()).map_err(tls_error)?;
    let mut server_config =
        ServerConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_safe_default_protocol_versions()
            .map_err(tls_error)?
            .with_no_client_auth()
            .with_single_cert(certificates, private_key)
            .map_err(tls_error)?;
    server_config.alpn_protocols = vec![b"http/1.1".to_vec()];
    Ok(Arc::new(server_config))
}

/// Binds `--provider-tls-addr` with the user's certificate, or one from SendMock's local CA in
/// `generated_folder` (made once). Off when the address is not set.
pub async fn bind_tls_provider_listener(
    tls_config: Option<&ProviderTlsConfig>,
    generated_folder: Option<&Path>,
) -> Result<Option<BoundTlsProviderListener>, StartupError> {
    let Some(tls_config) = tls_config else {
        return Ok(None);
    };
    let (certificate_pem, key_pem, ca_certificate) =
        match (&tls_config.certificate_file, &tls_config.key_file) {
            (Some(certificate_file), Some(key_file)) => (
                read_pem_file(certificate_file)?,
                read_pem_file(key_file)?,
                None,
            ),
            _ => {
                let ca_folder = generated_folder
                    .map(Path::to_path_buf)
                    .unwrap_or_else(default_ca_folder);
                let issued = issue_server_certificate(&ca_folder, &tls_config.extra_names)
                    .map_err(tls_error)?;
                let ca_certificate = (issued.ca_certificate_path, issued.ca_certificate_pem);
                (issued.certificate_pem, issued.key_pem, Some(ca_certificate))
            }
        };
    let server_config = build_server_config(&certificate_pem, &key_pem)?;
    let tcp_listener = bind_listener(tls_config.tls_addr, "--provider-tls-addr").await?;
    let bound_addr = tcp_listener
        .local_addr()
        .map_err(|source| StartupError::Listen {
            address: tls_config.tls_addr,
            source,
        })?;
    Ok(Some(BoundTlsProviderListener {
        listener: TlsProviderListener {
            tcp_listener,
            tls_acceptor: TlsAcceptor::from(server_config),
        },
        details: ProviderTlsDetails {
            address: bound_addr.to_string(),
            ca_certificate_path: ca_certificate
                .as_ref()
                .map(|(ca_path, _)| ca_path.display().to_string()),
            ca_certificate_pem: ca_certificate.map(|(_, ca_pem)| ca_pem),
        },
        bound_addr,
    }))
}

/// Serves the provider routes over HTTPS until the shutdown signal.
pub fn start_tls_provider_listener(
    background_tasks: &mut JoinSet<()>,
    bound_listener: BoundTlsProviderListener,
    operation_context: &OperationContext,
    shutdown_receiver: &watch::Receiver<bool>,
) {
    let provider_router = build_provider_port_router(operation_context, None);
    let mut listener_shutdown = shutdown_receiver.clone();
    let bound_addr = bound_listener.bound_addr;
    background_tasks.spawn(async move {
        let shutdown_signal = async move {
            let _ = listener_shutdown.wait_for(|is_stopping| *is_stopping).await;
        };
        if let Err(serve_error) =
            serve_http(bound_listener.listener, provider_router, shutdown_signal).await
        {
            tracing::error!(provider_tls_addr = %bound_addr, error = %serve_error, "HTTPS provider listener stopped");
        }
    });
}
