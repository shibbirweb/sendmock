#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::io::{self, Read, Write};
use std::net::{TcpListener, TcpStream};

use serde_json::Value;
use support::http_get::send_http_get;
use support::sendmock_process::{SendmockProcess, sendmock_command};

const TWILIO_SEND_PATH: &str =
    "/2010-04-01/Accounts/ACtest00000000000000000000000000/Messages.json";
const TWILIO_SEND_FORM: &str = "To=%2B8801700000000&From=%2B15005550006&Body=Hi";

/// The status line and body of a form POST, without an HTTP client crate.
fn post_form(
    address: &str,
    path: &str,
    host: &str,
    form_body: &str,
) -> io::Result<(String, String)> {
    let mut stream = TcpStream::connect(address)?;
    write!(
        stream,
        "POST {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: {}\r\n\r\n{form_body}",
        form_body.len()
    )?;
    let mut response_text = String::new();
    stream.read_to_string(&mut response_text)?;
    let status_line = response_text.lines().next().unwrap_or_default().to_owned();
    let body = response_text
        .split_once("\r\n\r\n")
        .map(|(_, body)| body.to_owned())
        .unwrap_or_default();
    Ok((status_line, body))
}

fn find_free_port() -> io::Result<u16> {
    Ok(TcpListener::bind("127.0.0.1:0")?.local_addr()?.port())
}

// AC: SM-14.1
// AC: SM-14.2
// AC: SM-14.3
#[test]
fn provider_apis_answer_at_their_real_paths_on_the_provider_ports() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let twilio_port = find_free_port()?;
    let server = SendmockProcess::start(sendmock_command(working_directory.path()).args([
        "--ready-json",
        "--http-addr",
        "127.0.0.1:0",
        "--provider-addr",
        "127.0.0.1:0",
        "--provider-port",
        &format!("twilio={twilio_port}"),
        "--db",
        "memory",
    ]))?;
    let ready_fields: Value =
        serde_json::from_str(&server.wait_for_line("provider_addr")).map_err(io::Error::other)?;
    let http_addr = ready_fields["http_addr"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let provider_addr = ready_fields["provider_addr"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let twilio_addr = format!("127.0.0.1:{twilio_port}");

    let (shared_status, shared_body) = post_form(
        &provider_addr,
        TWILIO_SEND_PATH,
        "api.twilio.com",
        TWILIO_SEND_FORM,
    )?;
    let (vonage_status, _) = post_form(
        &provider_addr,
        "/sms/json",
        "rest.nexmo.com",
        "from=Acme&to=447700900000&text=Hi",
    )?;
    let (dedicated_status, _) = post_form(
        &twilio_addr,
        TWILIO_SEND_PATH,
        "localhost",
        TWILIO_SEND_FORM,
    )?;
    let (other_provider_status, _) = post_form(
        &twilio_addr,
        "/sms/json",
        "localhost",
        "from=Acme&to=447700900000&text=Hi",
    )?;
    let (prefixed_status, _) = post_form(
        &http_addr,
        &format!("/providers/twilio{TWILIO_SEND_PATH}"),
        "localhost",
        TWILIO_SEND_FORM,
    )?;
    let stored_messages = send_http_get(&http_addr, "/api/v1/sms")?;

    let created_message: Value = serde_json::from_str(&shared_body).map_err(io::Error::other)?;
    assert!(shared_status.contains(" 201 "), "{shared_status}");
    assert!(
        created_message["sid"]
            .as_str()
            .is_some_and(|sid| sid.starts_with("SM"))
    );
    assert!(vonage_status.contains(" 200 "), "{vonage_status}");
    assert!(dedicated_status.contains(" 201 "), "{dedicated_status}");
    assert!(
        other_provider_status.contains(" 404 "),
        "{other_provider_status}"
    );
    assert!(prefixed_status.contains(" 201 "), "{prefixed_status}");
    assert!(
        stored_messages.contains("\"total_count\":4"),
        "{stored_messages}"
    );
    Ok(())
}
