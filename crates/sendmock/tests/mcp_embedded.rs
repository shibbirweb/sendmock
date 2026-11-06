#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod http_get;
    pub mod http_post;
    pub mod mcp_session;
    pub mod sendmock_process;
}

use std::io;
use std::net::TcpListener;

use serde_json::{Value, json};
use support::http_get::send_http_get;
use support::http_post::send_http_post;
use support::mcp_session::McpSession;
use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

/// A local address nothing listens on, found by binding port `0` and letting it go.
fn find_unused_local_addr() -> io::Result<String> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    Ok(listener.local_addr()?.to_string())
}

fn read_json_body(raw_response: &str) -> io::Result<Value> {
    let body = raw_response
        .split_once("\r\n\r\n")
        .map_or("", |(_, body)| body);
    serde_json::from_str(body).map_err(io::Error::other)
}

fn listed_subjects(email_list: &Value) -> Vec<String> {
    email_list["items"]
        .as_array()
        .map(|emails| {
            emails
                .iter()
                .filter_map(|email| email["subject"].as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

// AC: AI-02.5
#[test]
fn with_no_server_running_embedded_starts_one_the_tools_and_the_api_share() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let http_addr = find_unused_local_addr()?;
    let mut mcp_command = sendmock_command(working_directory.path());
    mcp_command.env("SENDMOCK_DB", "memory").args([
        "mcp",
        "--embedded",
        "--server",
        &format!("http://{http_addr}"),
    ]);
    // The session reads every stdout line as JSON-RPC, so a log line there fails the test.
    let mut mcp_session = McpSession::start_command(&mut mcp_command)?;

    let send_result = mcp_session.call_tool(
        "sendmock_email_send",
        json!({ "from": "app@shop.test", "to": ["sam@example.test"], "subject": "Embedded welcome", "text": "Hello" }),
    )?;
    let email_list = read_json_body(&send_http_get(&http_addr, "/api/v1/emails")?)?;

    assert_eq!(send_result["isError"], json!(false));
    assert_eq!(listed_subjects(&email_list), vec!["Embedded welcome"]);
    Ok(())
}

// AC: AI-02.5
#[test]
fn with_a_server_running_embedded_uses_it_and_starts_nothing() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let http_addr = sendmock.wait_for_http_addr();
    send_http_post(
        &http_addr,
        "/api/v1/send",
        r#"{"from":"app@shop.test","to":["sam@example.test"],"subject":"Sent before the session","text":"Hello"}"#,
    )?;
    let mut mcp_session = McpSession::start(working_directory.path(), &http_addr, &["--embedded"])?;

    let list_result = mcp_session.call_tool("sendmock_email_list", json!({}))?;

    assert_eq!(list_result["isError"], json!(false));
    assert_eq!(
        listed_subjects(&list_result["structuredContent"]),
        vec!["Sent before the session"]
    );
    Ok(())
}

// AC: AI-02.5
#[test]
fn embedded_refuses_a_server_on_another_host() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;

    let output = run_until_exit(sendmock_command(working_directory.path()).args([
        "mcp",
        "--embedded",
        "--server",
        "http://192.0.2.10:8025",
    ]))?;

    assert!(!output.status.success());
    assert!(
        String::from_utf8_lossy(&output.stderr)
            .contains("--embedded starts a server only at a local address"),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    Ok(())
}
