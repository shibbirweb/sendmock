#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::io;

use serde_json::Value;
use support::http_get::send_http_get;
use support::sendmock_process::{SendmockProcess, sendmock_command};

/// A server with the provider APIs over HTTPS from its local CA, and its ready line.
struct TlsProviderServer {
    _server: SendmockProcess,
    working_directory: tempfile::TempDir,
    ready_fields: Value,
}

fn start_tls_provider_server() -> io::Result<TlsProviderServer> {
    let working_directory = tempfile::tempdir()?;
    let database_path = working_directory.path().join("sendmock.db");
    let server = SendmockProcess::start(sendmock_command(working_directory.path()).args([
        "--ready-json",
        "--http-addr",
        "127.0.0.1:0",
        "--provider-tls-addr",
        "127.0.0.1:0",
        "--db",
        &database_path.display().to_string(),
    ]))?;
    let ready_fields: Value = serde_json::from_str(&server.wait_for_line("provider_tls_addr"))
        .map_err(io::Error::other)?;
    Ok(TlsProviderServer {
        _server: server,
        working_directory,
        ready_fields,
    })
}

/// The JSON body of a GET to the HTTP port.
fn get_json(http_addr: &str, path: &str) -> io::Result<Value> {
    let raw_response = send_http_get(http_addr, path)?;
    let body = raw_response
        .split_once("\r\n\r\n")
        .map(|(_, body)| body)
        .unwrap_or_default();
    serde_json::from_str(body).map_err(io::Error::other)
}

fn read_ready_address(ready_fields: &Value, field_name: &str) -> String {
    ready_fields[field_name]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

// AC: PL-20.1
// AC: PL-20.2
// AC: PL-20.3
#[tokio::test]
async fn the_provider_apis_answer_over_https_with_a_certificate_from_the_local_ca() -> io::Result<()>
{
    let _ = rustls::crypto::ring::default_provider().install_default();
    let server = start_tls_provider_server()?;
    let http_addr = read_ready_address(&server.ready_fields, "http_addr");
    let tls_addr = read_ready_address(&server.ready_fields, "provider_tls_addr");
    let tls_port = tls_addr.rsplit(':').next().unwrap_or_default().to_owned();

    let certificate_authority = get_json(&http_addr, "/api/v1/tls/ca")?;
    let ca_pem = certificate_authority["pem"].as_str().unwrap_or_default();
    let trusting_client = reqwest::Client::builder()
        .add_root_certificate(
            reqwest::Certificate::from_pem(ca_pem.as_bytes()).map_err(io::Error::other)?,
        )
        .build()
        .map_err(io::Error::other)?;
    let accounts_answer = trusting_client
        .get(format!(
            "https://localhost:{tls_port}/2010-04-01/Accounts.json"
        ))
        .send()
        .await
        .map_err(io::Error::other)?;
    let untrusting_answer = reqwest::Client::new()
        .get(format!(
            "https://localhost:{tls_port}/2010-04-01/Accounts.json"
        ))
        .send()
        .await;

    assert_eq!(accounts_answer.status().as_u16(), 401);
    assert!(
        untrusting_answer.is_err(),
        "a client without the CA refuses the certificate"
    );
    assert!(ca_pem.starts_with("-----BEGIN CERTIFICATE-----"));
    let ca_path = certificate_authority["path"].as_str().unwrap_or_default();
    assert!(ca_path.starts_with(&server.working_directory.path().display().to_string()));
    assert_eq!(
        certificate_authority["provider_tls_address"],
        tls_addr.as_str()
    );
    Ok(())
}

// AC: PL-20.4
#[test]
fn the_ready_line_and_the_info_name_the_https_address() -> io::Result<()> {
    let server = start_tls_provider_server()?;
    let http_addr = read_ready_address(&server.ready_fields, "http_addr");

    let app_info = get_json(&http_addr, "/api/v1/info")?;

    let tls_addr = read_ready_address(&server.ready_fields, "provider_tls_addr");
    assert!(
        tls_addr.starts_with("127.0.0.1:"),
        "{}",
        server.ready_fields
    );
    assert_eq!(app_info["provider_tls_address"], tls_addr.as_str());
    Ok(())
}

// AC: PL-20.1
#[test]
fn https_on_the_provider_port_is_off_by_default() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let server = SendmockProcess::start(sendmock_command(working_directory.path()).args([
        "--ready-json",
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
    ]))?;
    let ready_fields: Value =
        serde_json::from_str(&server.wait_for_line("http_addr")).map_err(io::Error::other)?;

    assert_eq!(ready_fields["provider_tls_addr"], Value::Null);
    let http_addr = read_ready_address(&ready_fields, "http_addr");
    let raw_response = send_http_get(&http_addr, "/api/v1/tls/ca")?;
    let status_line = raw_response.lines().next().unwrap_or_default();
    assert!(status_line.contains("404"), "{status_line}");
    Ok(())
}
