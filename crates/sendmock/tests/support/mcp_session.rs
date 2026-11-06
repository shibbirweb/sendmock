use std::io::{self, BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};

use serde_json::{Value, json};

use super::sendmock_process::sendmock_command;

/// A `sendmock mcp` process spoken to in JSON-RPC lines, killed on drop.
pub struct McpSession {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    next_request_id: u64,
}

impl McpSession {
    pub fn start(
        working_directory: &std::path::Path,
        http_addr: &str,
        extra_arguments: &[&str],
    ) -> io::Result<Self> {
        let mut mcp_command = sendmock_command(working_directory);
        mcp_command
            .args(["mcp", "--server", &format!("http://{http_addr}")])
            .args(extra_arguments);
        Self::start_command(&mut mcp_command)
    }

    /// Starts and initialises a session from a prepared `sendmock mcp` command.
    pub fn start_command(mcp_command: &mut Command) -> io::Result<Self> {
        let mut child = mcp_command
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

    pub fn send_line(&mut self, message: &Value) -> io::Result<()> {
        writeln!(self.stdin, "{message}")?;
        self.stdin.flush()
    }

    /// Sends a request and answers its `result`, skipping notifications.
    pub fn request(&mut self, method: &str, params: Value) -> io::Result<Value> {
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

    pub fn call_tool(&mut self, tool_name: &str, arguments: Value) -> io::Result<Value> {
        self.request(
            "tools/call",
            json!({ "name": tool_name, "arguments": arguments }),
        )
    }

    pub fn list_tools(&mut self) -> io::Result<Vec<Value>> {
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

impl McpSession {
    /// Sends `ping` and answers the notifications that arrived before its answer, so a test
    /// never waits on a notification that does not come.
    pub fn collect_notifications(&mut self) -> io::Result<Vec<Value>> {
        let request_id = self.next_request_id;
        self.next_request_id += 1;
        self.send_line(&json!({ "jsonrpc": "2.0", "id": request_id, "method": "ping" }))?;
        let mut notifications = Vec::new();
        loop {
            let mut message_line = String::new();
            if self.stdout.read_line(&mut message_line)? == 0 {
                return Err(io::Error::other("sendmock mcp closed stdout"));
            }
            let message: Value = serde_json::from_str(&message_line).map_err(io::Error::other)?;
            if message["id"] == request_id {
                return Ok(notifications);
            }
            if message.get("method").is_some() {
                notifications.push(message);
            }
        }
    }
}
