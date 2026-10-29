#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod sendmock_process;
}

use std::io::{self, Read, Write};
use std::net::TcpStream;
use std::time::Duration;

use support::http_get::send_http_get;
use support::sendmock_process::{SendmockProcess, sendmock_command};

const INITIALIZE_REQUEST: &str = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"sendmock-test","version":"1"}}}"#;

/// Posts a JSON-RPC message to `/mcp` and reads until the answer to it arrives (the
/// answer comes as a server-sent event, and the stream may stay open).
fn post_to_mcp(http_addr: &str, json_rpc_message: &str, extra_headers: &str) -> io::Result<String> {
    let mut stream = TcpStream::connect(http_addr)?;
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    write!(
        stream,
        "POST /mcp HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nAccept: application/json, text/event-stream\r\n{extra_headers}Content-Length: {}\r\n\r\n{json_rpc_message}",
        json_rpc_message.len()
    )?;
    let mut response_text = String::new();
    let mut read_buffer = [0_u8; 4096];
    // A notification is answered 202 with no body, a refusal 4xx; a request waits for its result.
    while !response_text.contains("\"result\"")
        && !response_text.starts_with("HTTP/1.1 4")
        && !response_text.starts_with("HTTP/1.1 202")
    {
        let read_count = stream.read(&mut read_buffer)?;
        if read_count == 0 {
            break;
        }
        response_text.push_str(&String::from_utf8_lossy(&read_buffer[..read_count]));
    }
    Ok(response_text)
}

fn read_session_id(response_text: &str) -> String {
    response_text
        .lines()
        .find_map(|header_line| {
            let (header_name, header_value) = header_line.split_once(':')?;
            header_name
                .eq_ignore_ascii_case("mcp-session-id")
                .then(|| header_value.trim().to_owned())
        })
        .unwrap_or_default()
}

// AC: AI-02.1
#[test]
fn the_server_exposes_the_registry_tools_over_streamable_http() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let http_addr = sendmock.wait_for_http_addr();

    let initialize_response = post_to_mcp(&http_addr, INITIALIZE_REQUEST, "")?;
    let session_header = format!(
        "Mcp-Session-Id: {}\r\n",
        read_session_id(&initialize_response)
    );
    post_to_mcp(
        &http_addr,
        r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#,
        &session_header,
    )?;
    let tools_response = post_to_mcp(
        &http_addr,
        r#"{"jsonrpc":"2.0","id":2,"method":"tools/list"}"#,
        &session_header,
    )?;

    assert!(
        initialize_response.starts_with("HTTP/1.1 200"),
        "{initialize_response}"
    );
    assert!(
        initialize_response.contains("\"name\":\"sendmock\""),
        "{initialize_response}"
    );
    assert!(
        tools_response.contains("\"sendmock_email_list\""),
        "{tools_response}"
    );
    assert!(tools_response.contains("\"inputSchema\""));
    Ok(())
}

// AC: PL-06.2
#[test]
fn with_ui_auth_mcp_over_http_needs_the_token_and_health_stays_open() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start(sendmock_command(working_directory.path()).args([
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
        "--log-format",
        "json",
        "--ui-auth",
        "admin:s3cret",
        "--api-token",
        "tok_123",
    ]))?;
    let http_addr = sendmock.wait_for_http_addr();

    let without_token = post_to_mcp(&http_addr, INITIALIZE_REQUEST, "")?;
    let with_token = post_to_mcp(
        &http_addr,
        INITIALIZE_REQUEST,
        "Authorization: Bearer tok_123\r\n",
    )?;
    let health_response = send_http_get(&http_addr, "/api/v1/health")?;
    let emails_response = send_http_get(&http_addr, "/api/v1/emails")?;

    assert!(without_token.starts_with("HTTP/1.1 401"), "{without_token}");
    assert!(with_token.starts_with("HTTP/1.1 200"), "{with_token}");
    assert!(health_response.starts_with("HTTP/1.1 200"));
    assert!(emails_response.starts_with("HTTP/1.1 401"));
    Ok(())
}

#[test]
fn the_cli_reaches_a_protected_server_with_the_token() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start(sendmock_command(working_directory.path()).args([
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
        "--log-format",
        "json",
        "--ui-auth",
        "admin:s3cret",
        "--api-token",
        "tok_123",
    ]))?;
    let server_url = format!("http://{}", sendmock.wait_for_http_addr());

    let with_token = sendmock_command(working_directory.path())
        .args([
            "email",
            "list",
            "--json",
            "--server",
            &server_url,
            "--token",
            "tok_123",
        ])
        .output()?;
    let without_token = sendmock_command(working_directory.path())
        .args(["email", "list", "--json", "--server", &server_url])
        .output()?;

    assert!(
        with_token.status.success(),
        "{}",
        String::from_utf8_lossy(&with_token.stderr)
    );
    assert!(!without_token.status.success());
    Ok(())
}
