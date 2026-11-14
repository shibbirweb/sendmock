#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod http_post;
    pub mod sendmock_process;
}

use std::io::{self, Read, Write};
use std::net::TcpStream;

use serde_json::Value;
use support::http_get::send_http_get;
use support::http_post::send_http_post;
use support::sendmock_process::{SendmockProcess, sendmock_command};

/// The status line and body of any request, without an HTTP client crate.
fn send_request(
    address: &str,
    method: &str,
    path: &str,
    body: &str,
) -> io::Result<(String, String)> {
    let mut stream = TcpStream::connect(address)?;
    write!(
        stream,
        "{method} {path} HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    )?;
    let mut response_text = String::new();
    stream.read_to_string(&mut response_text)?;
    let status_line = response_text.lines().next().unwrap_or_default().to_owned();
    let response_body = response_text
        .split_once("\r\n\r\n")
        .map(|(_, response_body)| response_body.to_owned())
        .unwrap_or_default();
    Ok((status_line, response_body))
}

fn read_json_body(raw_response: &str) -> io::Result<Value> {
    let body = raw_response
        .split_once("\r\n\r\n")
        .map_or("", |(_, body)| body);
    serde_json::from_str(body).map_err(io::Error::other)
}

/// A server with the catch-all port on, and its HTTP and catcher addresses.
struct CatcherPortServer {
    _server: SendmockProcess,
    _working_directory: tempfile::TempDir,
    http_addr: String,
    catcher_addr: String,
}

fn start_catcher_port_server() -> io::Result<CatcherPortServer> {
    let working_directory = tempfile::tempdir()?;
    let server = SendmockProcess::start(sendmock_command(working_directory.path()).args([
        "--ready-json",
        "--http-addr",
        "127.0.0.1:0",
        "--smtp-addr",
        "127.0.0.1:0",
        "--catcher-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
    ]))?;
    let ready_fields: Value =
        serde_json::from_str(&server.wait_for_line("catcher_addr")).map_err(io::Error::other)?;
    let read_address = |field_name: &str| {
        ready_fields[field_name]
            .as_str()
            .unwrap_or_default()
            .to_owned()
    };
    Ok(CatcherPortServer {
        http_addr: read_address("http_addr"),
        catcher_addr: read_address("catcher_addr"),
        _server: server,
        _working_directory: working_directory,
    })
}

// AC: HC-01.4
#[test]
fn the_catch_all_port_captures_any_method_and_path_into_the_bin_its_first_segment_names()
-> io::Result<()> {
    let catcher_server = start_catcher_port_server()?;

    let (put_status, put_body) = send_request(
        &catcher_server.catcher_addr,
        "PUT",
        "/orders/42/items?express=1",
        r#"{"sku":"A1"}"#,
    )?;
    let (root_status, _) = send_request(&catcher_server.catcher_addr, "GET", "/", "")?;
    let requests = read_json_body(&send_http_get(
        &catcher_server.http_addr,
        "/api/v1/http/requests",
    )?)?;

    assert!(put_status.contains("200"), "{put_status}");
    assert_eq!(put_body, r#"{"ok":true}"#);
    assert!(root_status.contains("200"), "{root_status}");
    let captured = requests["items"].as_array().cloned().unwrap_or_default();
    let orders_request = captured
        .iter()
        .find(|captured_request| captured_request["method"] == "PUT")
        .cloned()
        .unwrap_or_default();
    assert_eq!(orders_request["bin_name"], "orders");
    assert_eq!(orders_request["path"], "/catch/orders/42/items");
    assert_eq!(
        orders_request["url"],
        format!(
            "http://{}/orders/42/items?express=1",
            catcher_server.catcher_addr
        )
    );
    assert!(
        captured
            .iter()
            .any(|captured_request| captured_request["bin_name"] == "default"),
        "{captured:?}"
    );
    Ok(())
}

// AC: HC-01.4
#[test]
fn a_bin_rule_answers_on_the_catch_all_port_as_on_the_catch_path() -> io::Result<()> {
    let catcher_server = start_catcher_port_server()?;
    let created_bin = read_json_body(&send_http_post(
        &catcher_server.http_addr,
        "/api/v1/http/bins",
        r#"{"name":"payments","preset":null}"#,
    )?)?;
    let bin_id = created_bin["id"].as_str().unwrap_or_default().to_owned();
    let declined_rule = serde_json::json!([{
        "id": "rule-declined", "name": "Declined", "is_enabled": true, "method": "POST",
        "path_glob": "/charge", "filter": null,
        "response": { "status_code": 402, "headers": {}, "body": "{\"declined\":true}" },
        "delay_min_ms": 0, "delay_max_ms": 0, "failure_rate_percent": 0, "failure_status_code": 503,
    }]);
    let (rules_status, _) = send_request(
        &catcher_server.http_addr,
        "PUT",
        &format!("/api/v1/http/bins/{bin_id}/responses"),
        &declined_rule.to_string(),
    )?;

    let (charge_status, charge_body) = send_request(
        &catcher_server.catcher_addr,
        "POST",
        "/payments/charge",
        "{}",
    )?;

    assert!(rules_status.contains("200"), "{rules_status}");
    assert!(charge_status.contains("402"), "{charge_status}");
    assert_eq!(charge_body, r#"{"declined":true}"#);
    Ok(())
}

// AC: HC-01.4
#[test]
fn info_names_the_catch_all_port_only_when_it_is_on() -> io::Result<()> {
    let catcher_server = start_catcher_port_server()?;
    let working_directory = tempfile::tempdir()?;
    let plain_server = SendmockProcess::start_with_free_port(working_directory.path())?;
    let plain_http_addr = plain_server.wait_for_http_addr();

    let info_with_port =
        read_json_body(&send_http_get(&catcher_server.http_addr, "/api/v1/info")?)?;
    let info_without_port = read_json_body(&send_http_get(&plain_http_addr, "/api/v1/info")?)?;

    assert_eq!(
        info_with_port["catcher_address"],
        catcher_server.catcher_addr
    );
    assert_eq!(info_without_port["catcher_address"], Value::Null);
    Ok(())
}
