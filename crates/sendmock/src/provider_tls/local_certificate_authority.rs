use std::net::IpAddr;
use std::path::{Path, PathBuf};

use rcgen::{
    BasicConstraints, CertificateParams, CidrSubnet, DistinguishedName, DnType,
    ExtendedKeyUsagePurpose, GeneralSubtree, IsCa, Issuer, KeyPair, KeyUsagePurpose,
    NameConstraints, date_time_ymd,
};

const CA_CERTIFICATE_FILE: &str = "provider-ca-certificate.pem";
const CA_KEY_FILE: &str = "provider-ca-key.pem";
const CA_COMMON_NAME: &str = "SendMock local CA";
/// The names every provider certificate holds, so an SDK on this machine can connect.
const LOCAL_NAMES: [&str; 3] = ["localhost", "127.0.0.1", "::1"];

#[derive(Debug, thiserror::Error)]
pub enum CertificateAuthorityError {
    #[error("Could not keep the local CA in {folder}: {reason}")]
    Storage { folder: String, reason: String },
    #[error("Could not make a certificate: {0}")]
    Generation(String),
}

/// A server certificate issued by SendMock's local CA, and the CA to trust.
pub struct IssuedCertificate {
    pub certificate_pem: String,
    pub key_pem: String,
    pub ca_certificate_path: PathBuf,
    pub ca_certificate_pem: String,
}

/// Every name the certificate is for: the local ones, then `--provider-tls-names`.
pub fn list_certificate_names(extra_names: &[String]) -> Vec<String> {
    let mut certificate_names: Vec<String> =
        LOCAL_NAMES.iter().map(|name| (*name).to_owned()).collect();
    for extra_name in extra_names {
        let extra_name = extra_name.trim().to_owned();
        if !extra_name.is_empty() && !certificate_names.contains(&extra_name) {
            certificate_names.push(extra_name);
        }
    }
    certificate_names
}

/// The CA may only vouch for these names, so trusting it cannot vouch for any other site.
fn build_name_constraints(certificate_names: &[String]) -> NameConstraints {
    let permitted_subtrees = certificate_names
        .iter()
        .map(|name| match name.parse::<IpAddr>() {
            Ok(ip_address) => {
                let prefix = if ip_address.is_ipv4() { 32 } else { 128 };
                GeneralSubtree::IpAddress(CidrSubnet::from_addr_prefix(ip_address, prefix))
            }
            Err(_) => GeneralSubtree::DnsName(name.clone()),
        })
        .collect();
    NameConstraints {
        permitted_subtrees,
        excluded_subtrees: Vec::new(),
    }
}

/// Today's date as year, month and day, from the system clock.
fn read_today() -> (i32, u8, u8) {
    let today_text = sendmock_core::format_rfc3339(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|elapsed| i64::try_from(elapsed.as_millis()).unwrap_or_default())
            .unwrap_or_default(),
    );
    let mut date_parts = today_text.get(..10).unwrap_or("2026-01-01").split('-');
    let mut read_part = |fallback: u16| {
        date_parts
            .next()
            .and_then(|part| part.parse::<u16>().ok())
            .unwrap_or(fallback)
    };
    let year = i32::from(read_part(2026));
    let month = u8::try_from(read_part(1)).unwrap_or(1);
    // Day 28 at most, so a year later always exists.
    let day = u8::try_from(read_part(1)).unwrap_or(1).min(28);
    (year, month, day)
}

fn build_ca_params(certificate_names: &[String]) -> CertificateParams {
    let mut ca_params = CertificateParams::default();
    let mut distinguished_name = DistinguishedName::new();
    distinguished_name.push(DnType::CommonName, CA_COMMON_NAME);
    ca_params.distinguished_name = distinguished_name;
    ca_params.is_ca = IsCa::Ca(BasicConstraints::Constrained(0));
    ca_params.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];
    ca_params.name_constraints = Some(build_name_constraints(certificate_names));
    let (year, month, day) = read_today();
    ca_params.not_before = date_time_ymd(year, month, day);
    ca_params.not_after = date_time_ymd(year + 10, month, day);
    ca_params
}

fn storage_error(folder: &Path, reason: impl ToString) -> CertificateAuthorityError {
    CertificateAuthorityError::Storage {
        folder: folder.display().to_string(),
        reason: reason.to_string(),
    }
}

fn generation_error(reason: impl ToString) -> CertificateAuthorityError {
    CertificateAuthorityError::Generation(reason.to_string())
}

/// The CA's key and certificate, made once in `ca_folder` with the key readable only by the
/// user. A CA made for other names is made again, since its constraints name them.
fn load_or_create_ca(
    ca_folder: &Path,
    certificate_names: &[String],
) -> Result<(KeyPair, String), CertificateAuthorityError> {
    let certificate_path = ca_folder.join(CA_CERTIFICATE_FILE);
    let key_path = ca_folder.join(CA_KEY_FILE);
    let names_path = ca_folder.join("provider-ca-names.txt");
    let stored_names = std::fs::read_to_string(&names_path).unwrap_or_default();
    let stored_pair = std::fs::read_to_string(&key_path)
        .ok()
        .zip(std::fs::read_to_string(&certificate_path).ok())
        .filter(|_| stored_names == certificate_names.join("\n"));
    if let Some((key_pem, certificate_pem)) = stored_pair {
        let ca_key = KeyPair::from_pem(&key_pem).map_err(generation_error)?;
        return Ok((ca_key, certificate_pem));
    }
    let ca_key = KeyPair::generate().map_err(generation_error)?;
    let ca_certificate = build_ca_params(certificate_names)
        .self_signed(&ca_key)
        .map_err(generation_error)?;
    std::fs::create_dir_all(ca_folder).map_err(|error| storage_error(ca_folder, error))?;
    write_private_file(&key_path, &ca_key.serialize_pem())
        .map_err(|error| storage_error(ca_folder, error))?;
    std::fs::write(&certificate_path, ca_certificate.pem())
        .map_err(|error| storage_error(ca_folder, error))?;
    std::fs::write(&names_path, certificate_names.join("\n"))
        .map_err(|error| storage_error(ca_folder, error))?;
    Ok((ca_key, ca_certificate.pem()))
}

#[cfg(unix)]
fn write_private_file(file_path: &Path, contents: &str) -> std::io::Result<()> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    let mut private_file = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(file_path)?;
    private_file.write_all(contents.as_bytes())
}

#[cfg(not(unix))]
fn write_private_file(file_path: &Path, contents: &str) -> std::io::Result<()> {
    std::fs::write(file_path, contents)
}

/// A server certificate for the names, issued by the local CA at each start and valid for a
/// year, so it is renewed long before it expires.
pub fn issue_server_certificate(
    ca_folder: &Path,
    extra_names: &[String],
) -> Result<IssuedCertificate, CertificateAuthorityError> {
    let certificate_names = list_certificate_names(extra_names);
    let (ca_key, ca_certificate_pem) = load_or_create_ca(ca_folder, &certificate_names)?;
    let issuer = Issuer::new(build_ca_params(&certificate_names), ca_key);
    let mut server_params =
        CertificateParams::new(certificate_names.clone()).map_err(generation_error)?;
    server_params
        .distinguished_name
        .push(DnType::CommonName, "SendMock provider APIs");
    server_params.key_usages = vec![
        KeyUsagePurpose::DigitalSignature,
        KeyUsagePurpose::KeyEncipherment,
    ];
    server_params.extended_key_usages = vec![ExtendedKeyUsagePurpose::ServerAuth];
    let (year, month, day) = read_today();
    server_params.not_before = date_time_ymd(year, month, day);
    server_params.not_after = date_time_ymd(year + 1, month, day);
    let server_key = KeyPair::generate().map_err(generation_error)?;
    let server_certificate = server_params
        .signed_by(&server_key, &issuer)
        .map_err(generation_error)?;
    Ok(IssuedCertificate {
        certificate_pem: format!("{}{}", server_certificate.pem(), ca_certificate_pem),
        key_pem: server_key.serialize_pem(),
        ca_certificate_path: ca_folder.join(CA_CERTIFICATE_FILE),
        ca_certificate_pem,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-20.2
    #[test]
    fn the_certificate_covers_the_local_names_and_the_extra_ones_once() {
        assert_eq!(
            list_certificate_names(&["mail.test".to_owned(), "localhost".to_owned()]),
            ["localhost", "127.0.0.1", "::1", "mail.test"]
        );
    }

    // AC: PL-20.2
    #[test]
    fn the_ca_is_made_once_with_a_private_key_and_signs_each_server_certificate() {
        let ca_folder =
            std::env::temp_dir().join(format!("sendmock-ca-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&ca_folder);

        let first = issue_server_certificate(&ca_folder, &[]);
        let second = issue_server_certificate(&ca_folder, &[]);

        let (first, second) = match (first, second) {
            (Ok(first), Ok(second)) => (first, second),
            other => panic!("certificates were issued: {:?}", other.0.err()),
        };
        assert_eq!(first.ca_certificate_pem, second.ca_certificate_pem);
        assert_ne!(first.key_pem, second.key_pem);
        assert!(first.certificate_pem.contains(&first.ca_certificate_pem));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let key_mode = std::fs::metadata(ca_folder.join(CA_KEY_FILE))
                .map(|metadata| metadata.permissions().mode() & 0o777)
                .unwrap_or_default();
            assert_eq!(key_mode, 0o600);
        }
        let _ = std::fs::remove_dir_all(&ca_folder);
    }
}
