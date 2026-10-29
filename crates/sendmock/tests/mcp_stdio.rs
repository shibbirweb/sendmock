#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod sendmock_process;
}

use std::io::{self, BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Stdio};

use serde_json::{Value, json};
use support::sendmock_process::{SendmockProcess, sendmock_command};

/// A `sendmock mcp` process spoken to in JSON-RPC lines, killed on drop.
struct McpSession {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    next_request_id: u64,
}

impl McpSession {
    fn start(
        working_directory: &std::path::Path,
        http_addr: &str,
        extra_arguments: &[&str],
    ) -> io::Result<Self> {
        let mut child = sendmock_command(working_directory)
            .args(["mcp", "--server", &format!("http://{http_addr}")])
            .args(extra_arguments)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| io::Error::other("stdin is not piped"))?;
        let stdout = BufReader::new(
            child
                .stdout
                .take()
                .ok_or_else(|| io::Error::other("stdout is not piped"))?,
        );
        let mut mcp_session = Self {
            child,
            stdin,
            stdout,
            next_request_id: 1,
        };
        mcp_session.request(
            "initialize",
            json!({ "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": { "name": "sendmock-test", "version": "1" } }),
        )?;
        mcp_session
            .send_line(&json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }))?;
        Ok(mcp_session)
    }

    fn send_line(&mut self, message: &Value) -> io::Result<()> {
        writeln!(self.stdin, "{message}")?;
        self.stdin.flush()
    }

    /// Sends a request and answers its `result`, skipping notifications.
    fn request(&mut self, method: &str, params: Value) -> io::Result<Value> {
        let request_id = self.next_request_id;
        self.next_request_id += 1;
        self.send_line(
            &json!({ "jsonrpc": "2.0", "id": request_id, "method": method, "params": params }),
        )?;
        loop {
            let mut response_line = String::new();
            if self.stdout.read_line(&mut response_line)? == 0 {
                return Err(io::Error::other("sendmock mcp closed stdout"));
            }
            let response: Value = serde_json::from_str(&response_line).map_err(io::Error::other)?;
            if response["id"] == request_id {
                return Ok(response["result"].clone());
            }
        }
    }

    fn call_tool(&mut self, tool_name: &str, arguments: Value) -> io::Result<Value> {
        self.request(
            "tools/call",
            json!({ "name": tool_name, "arguments": arguments }),
        )
    }

    fn list_tools(&mut self) -> io::Result<Vec<Value>> {
        Ok(self.request("tools/list", json!({}))?["tools"]
            .as_array()
            .cloned()
            .unwrap_or_default())
    }
}

impl Drop for McpSession {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn find_tool<'tools>(tools: &'tools [Value], tool_name: &str) -> Option<&'tools Value> {
    tools.iter().find(|tool| tool["name"] == tool_name)
}

// AC: AI-02.2
#[test]
fn the_tools_send_mail_and_read_the_code_with_honest_annotations() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let mut mcp_session = McpSession::start(
        working_directory.path(),
        &sendmock.wait_for_http_addr(),
        &[],
    )?;

    let tools = mcp_session.list_tools()?;
    let send_result = mcp_session.call_tool(
        "sendmock_email_send",
        json!({ "from": "app@shop.test", "to": ["sam@example.test"], "subject": "Code", "text": "Your code is 482913" }),
    )?;
    let otp_result =
        mcp_session.call_tool("sendmock_otp_get", json!({ "to": "sam@example.test" }))?;

    assert_eq!(
        find_tool(&tools, "sendmock_email_list").map(|tool| &tool["annotations"]["readOnlyHint"]),
        Some(&json!(true))
    );
    assert_eq!(
        find_tool(&tools, "sendmock_email_delete")
            .map(|tool| &tool["annotations"]["destructiveHint"]),
        Some(&json!(true))
    );
    assert_eq!(send_result["isError"], json!(false));
    assert_eq!(otp_result["structuredContent"]["code"], "482913");
    Ok(())
}

// AC: AI-02.3
#[test]
fn toolsets_and_read_only_limit_what_an_agent_sees() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let http_addr = sendmock.wait_for_http_addr();

    let logs_tools = McpSession::start(
        working_directory.path(),
        &http_addr,
        &["--toolsets", "logs"],
    )?
    .list_tools()?;
    let read_only_tools = McpSession::start(
        working_directory.path(),
        &http_addr,
        &["--toolsets", "all", "--read-only"],
    )?
    .list_tools()?;
    let default_tools =
        McpSession::start(working_directory.path(), &http_addr, &[])?.list_tools()?;

    assert!(!logs_tools.is_empty());
    assert!(logs_tools.iter().all(|tool| {
        tool["name"]
            .as_str()
            .is_some_and(|name| name.starts_with("sendmock_logs_"))
    }));
    assert!(
        read_only_tools
            .iter()
            .all(|tool| tool["annotations"]["readOnlyHint"] == json!(true))
    );
    assert!(find_tool(&read_only_tools, "sendmock_settings_get").is_some());
    assert!(find_tool(&default_tools, "sendmock_settings_get").is_none());
    Ok(())
}

// AC: AI-02.4
#[test]
fn a_secret_set_through_a_tool_is_never_read_back() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let mut mcp_session = McpSession::start(
        working_directory.path(),
        &sendmock.wait_for_http_addr(),
        &["--toolsets", "all"],
    )?;

    let update_result = mcp_session.call_tool(
        "sendmock_settings_update",
        json!({ "relay_smtp_url": "smtp://mailer:s3cret-pass@relay.test:587" }),
    )?;
    let settings_result = mcp_session.call_tool("sendmock_settings_get", json!({}))?;

    for tool_result in [&update_result, &settings_result] {
        assert!(
            !tool_result.to_string().contains("s3cret-pass"),
            "{tool_result}"
        );
    }
    assert_eq!(
        settings_result["structuredContent"]["relay_smtp_url"],
        "smtp://mailer:********@relay.test:587"
    );
    Ok(())
}

#[test]
fn a_failing_call_is_a_tool_error_the_agent_can_read() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let mut mcp_session = McpSession::start(
        working_directory.path(),
        &sendmock.wait_for_http_addr(),
        &[],
    )?;

    let missing_email = mcp_session.call_tool(
        "sendmock_email_get",
        json!({ "email_id": "01JNOTHEREATALL0000000000" }),
    )?;

    assert_eq!(missing_email["isError"], json!(true));
    assert!(missing_email.to_string().contains("No email"));
    Ok(())
}
