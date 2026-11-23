//! Which local CA `sendmock trust` works on: the running server's, so a server started with
//! `--db <path>` (its CA kept beside that database) is the one trusted, else the CA in
//! SendMock's data folder, which every other server uses.

use std::path::{Path, PathBuf};

use sendmock_cli::{ApiAnswer, ApiClient};
use sendmock_ops::{GetTlsCaOperation, Operation};
use serde_json::json;

use super::trust_target::LocalCa;
use crate::provider_tls::{default_ca_folder, load_local_ca_certificate};

const CA_CERTIFICATE_FILE: &str = "provider-ca-certificate.pem";

/// The CA to trust and where it came from, as `sendmock trust` prints it.
pub struct ChosenCa {
    pub local_ca: LocalCa,
    pub source: String,
}

/// The CA kept in `ca_folder`, made when there is none.
pub fn load_folder_ca(ca_folder: &Path) -> Result<LocalCa, String> {
    let (certificate_path, certificate_pem) =
        load_local_ca_certificate(ca_folder, &[]).map_err(|error| error.to_string())?;
    Ok(LocalCa {
        certificate_path,
        certificate_pem,
        bundle_folder: ca_folder.join("trust"),
    })
}

/// The CA in `ca_folder` when it already exists, for reports that must not make one.
pub fn read_existing_folder_ca(ca_folder: &Path) -> Result<LocalCa, String> {
    let certificate_path = ca_folder.join(CA_CERTIFICATE_FILE);
    let certificate_pem = std::fs::read_to_string(&certificate_path)
        .map_err(|_| "No local CA yet: run sendmock trust".to_owned())?;
    Ok(LocalCa {
        certificate_path,
        certificate_pem,
        bundle_folder: ca_folder.join("trust"),
    })
}

/// The CA a server reported, with its bundles kept beside it.
pub fn server_ca(certificate_path: &str, certificate_pem: &str) -> LocalCa {
    let certificate_path = PathBuf::from(certificate_path);
    let bundle_folder = certificate_path
        .parent()
        .map_or_else(default_ca_folder, Path::to_path_buf)
        .join("trust");
    LocalCa {
        certificate_path,
        certificate_pem: certificate_pem.to_owned(),
        bundle_folder,
    }
}

/// The running server's CA (`GET /api/v1/tls/ca`): its path and PEM, or `None` when no
/// server answers or it has no local CA.
fn fetch_server_ca(server_url: &str) -> Option<(String, String)> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .ok()?;
    let api_client = ApiClient::new(server_url.to_owned(), None);
    let definition = GetTlsCaOperation.definition();
    match runtime.block_on(api_client.call_operation(&definition, &json!({}))) {
        Ok(ApiAnswer::Json(answer)) => Some((
            answer["path"].as_str()?.to_owned(),
            answer["pem"].as_str()?.to_owned(),
        )),
        _ => None,
    }
}

/// The running server's CA when one answers at `server_url`, else the data folder's.
pub fn choose_local_ca(server_url: &str) -> Result<ChosenCa, String> {
    choose_from(
        fetch_server_ca(server_url),
        server_url,
        &default_ca_folder(),
    )
}

/// The server's answer when there is one, else the CA in `data_folder`.
fn choose_from(
    server_answer: Option<(String, String)>,
    server_url: &str,
    data_folder: &Path,
) -> Result<ChosenCa, String> {
    if let Some((certificate_path, certificate_pem)) = server_answer {
        return Ok(ChosenCa {
            local_ca: server_ca(&certificate_path, &certificate_pem),
            source: format!("the CA of the SendMock at {server_url}"),
        });
    }
    Ok(ChosenCa {
        local_ca: load_folder_ca(data_folder)?,
        source: "the CA in SendMock's data folder (no server answered)".to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-25.6
    #[test]
    fn a_servers_ca_keeps_its_bundles_beside_it() {
        let local_ca = server_ca(
            "/projects/app/.sendmock/provider-ca-certificate.pem",
            "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n",
        );

        assert_eq!(
            local_ca.certificate_path,
            PathBuf::from("/projects/app/.sendmock/provider-ca-certificate.pem")
        );
        assert_eq!(
            local_ca.bundle_folder,
            PathBuf::from("/projects/app/.sendmock/trust")
        );
    }

    // AC: PL-25.6
    #[test]
    fn the_running_servers_ca_wins_and_the_data_folders_is_used_when_none_answers() {
        let data_folder = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let server_answer = Some((
            "/projects/app/provider-ca-certificate.pem".to_owned(),
            "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n".to_owned(),
        ));

        let from_server = choose_from(server_answer, "http://127.0.0.1:8025", data_folder.path())
            .unwrap_or_else(|error| panic!("{error}"));
        let from_folder = choose_from(None, "http://127.0.0.1:8025", data_folder.path())
            .unwrap_or_else(|error| panic!("{error}"));

        assert_eq!(
            from_server.local_ca.certificate_path,
            PathBuf::from("/projects/app/provider-ca-certificate.pem")
        );
        assert!(
            from_server.source.contains("http://127.0.0.1:8025"),
            "{}",
            from_server.source
        );
        assert_eq!(
            from_folder.local_ca.certificate_path,
            data_folder.path().join(CA_CERTIFICATE_FILE)
        );
        assert!(
            from_folder.source.contains("data folder"),
            "{}",
            from_folder.source
        );
    }

    // AC: PL-25.6
    #[test]
    fn a_server_reads_the_ca_in_its_own_folder() {
        let ca_folder = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
        let made_ca = load_folder_ca(ca_folder.path()).unwrap_or_else(|error| panic!("{error}"));

        let read_ca =
            read_existing_folder_ca(ca_folder.path()).unwrap_or_else(|error| panic!("{error}"));

        assert_eq!(read_ca.certificate_path, made_ca.certificate_path);
        assert_eq!(read_ca.certificate_pem, made_ca.certificate_pem);
    }
}
