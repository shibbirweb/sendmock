/// Makes ring the TLS provider for HTTPS clients, the same one SMTP uses, so the binary
/// carries one crypto library. Safe to call more than once.
pub fn install_tls_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}
