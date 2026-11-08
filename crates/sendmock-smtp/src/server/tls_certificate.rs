use std::path::Path;
use std::sync::Arc;

use rustls::ServerConfig;
use rustls::pki_types::pem::PemObject;
use rustls::pki_types::{CertificateDer, PrivateKeyDer};

const GENERATED_CERTIFICATE_FILE: &str = "smtp-certificate.pem";
const GENERATED_KEY_FILE: &str = "smtp-key.pem";

#[derive(Debug, thiserror::Error)]
pub enum TlsSetupError {
    #[error("Could not read the TLS certificate or key {file_path}: {reason}")]
    UnreadableFile { file_path: String, reason: String },

    #[error("Could not generate a TLS certificate: {0}")]
    Generation(String),

    #[error("The TLS certificate and key do not work together: {0}")]
    InvalidPair(String),
}

/// Where the certificate comes from: the user's files, or one SendMock generates on first
/// run and keeps in `generated_folder` (in memory only when there is no folder).
pub struct TlsCertificateSource<'paths> {
    pub certificate_file: Option<&'paths Path>,
    pub key_file: Option<&'paths Path>,
    pub generated_folder: Option<&'paths Path>,
    pub hostname: &'paths str,
}

pub fn build_tls_server_config(
    source: &TlsCertificateSource<'_>,
) -> Result<Arc<ServerConfig>, TlsSetupError> {
    let (certificate_pem, key_pem) = match (source.certificate_file, source.key_file) {
        (Some(certificate_file), Some(key_file)) => {
            (read_text(certificate_file)?, read_text(key_file)?)
        }
        _ => load_or_generate_certificate(source)?,
    };
    let certificates = CertificateDer::pem_slice_iter(certificate_pem.as_bytes())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|parse_error| TlsSetupError::InvalidPair(parse_error.to_string()))?;
    let private_key = PrivateKeyDer::from_pem_slice(key_pem.as_bytes())
        .map_err(|parse_error| TlsSetupError::InvalidPair(parse_error.to_string()))?;
    let server_config =
        ServerConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_safe_default_protocol_versions()
            .map_err(|tls_error| TlsSetupError::InvalidPair(tls_error.to_string()))?
            .with_no_client_auth()
            .with_single_cert(certificates, private_key)
            .map_err(|tls_error| TlsSetupError::InvalidPair(tls_error.to_string()))?;
    Ok(Arc::new(server_config))
}

/// The generated certificate's PEM, for clients (and tests) that want to trust it.
pub fn read_generated_certificate(generated_folder: &Path) -> Option<String> {
    std::fs::read_to_string(generated_folder.join(GENERATED_CERTIFICATE_FILE)).ok()
}

fn load_or_generate_certificate(
    source: &TlsCertificateSource<'_>,
) -> Result<(String, String), TlsSetupError> {
    if let Some(generated_folder) = source.generated_folder {
        let certificate_path = generated_folder.join(GENERATED_CERTIFICATE_FILE);
        let key_path = generated_folder.join(GENERATED_KEY_FILE);
        if certificate_path.is_file() && key_path.is_file() {
            return Ok((read_text(&certificate_path)?, read_text(&key_path)?));
        }
    }
    let subject_names = vec![
        "localhost".to_owned(),
        source.hostname.to_owned(),
        "127.0.0.1".to_owned(),
    ];
    let generated = rcgen::generate_simple_self_signed(subject_names)
        .map_err(|generation_error| TlsSetupError::Generation(generation_error.to_string()))?;
    let certificate_pem = generated.cert.pem();
    let key_pem = generated.signing_key.serialize_pem();
    if let Some(generated_folder) = source.generated_folder {
        // A certificate that cannot be saved still works for this run.
        let _ = std::fs::create_dir_all(generated_folder)
            .and_then(|()| {
                std::fs::write(
                    generated_folder.join(GENERATED_CERTIFICATE_FILE),
                    &certificate_pem,
                )
            })
            .and_then(|()| std::fs::write(generated_folder.join(GENERATED_KEY_FILE), &key_pem));
    }
    Ok((certificate_pem, key_pem))
}

fn read_text(file_path: &Path) -> Result<String, TlsSetupError> {
    std::fs::read_to_string(file_path).map_err(|read_error| TlsSetupError::UnreadableFile {
        file_path: file_path.display().to_string(),
        reason: read_error.to_string(),
    })
}
