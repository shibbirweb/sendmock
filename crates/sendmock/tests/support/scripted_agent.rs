use std::io::{self, BufRead, BufReader, Write};
use std::net::TcpStream;
use std::time::{Duration, Instant};

use serde_json::Value;

use super::mcp_session::McpSession;

const TOOL_WAIT: Duration = Duration::from_secs(15);

/// An agent that knows SendMock only from its skill: it calls a tool only when the skill names
/// it, over the MCP server its agent configuration starts.
pub struct ScriptedAgent {
    pub mcp_session: McpSession,
    skill_text: String,
    pub called_tools: Vec<String>,
}

impl ScriptedAgent {
    pub fn new(mcp_session: McpSession, skill_text: String) -> Self {
        Self {
            mcp_session,
            skill_text,
            called_tools: Vec::new(),
        }
    }

    /// Calls a tool the skill names and answers its result: the structured content, or the JSON
    /// in its text for answers that are not objects (lists). A tool the skill does not name, or
    /// an error result, fails the session.
    pub fn call_skill_tool(&mut self, tool_name: &str, arguments: Value) -> io::Result<Value> {
        if !self.skill_text.contains(&format!("`{tool_name}`")) {
            return Err(io::Error::other(format!(
                "the skill does not name {tool_name}"
            )));
        }
        self.called_tools.push(tool_name.to_owned());
        let tool_result = self.mcp_session.call_tool(tool_name, arguments)?;
        if tool_result["isError"] == true {
            return Err(io::Error::other(format!("{tool_name}: {tool_result}")));
        }
        if !tool_result["structuredContent"].is_null() {
            return Ok(tool_result["structuredContent"].clone());
        }
        let answer_text = tool_result["content"][0]["text"]
            .as_str()
            .unwrap_or_default();
        Ok(serde_json::from_str(answer_text).unwrap_or_else(|_| Value::from(answer_text)))
    }

    /// Calls the tool until its result passes the check, as an agent checks again after a wait.
    pub fn call_until(
        &mut self,
        tool_name: &str,
        arguments: &Value,
        is_done: impl Fn(&Value) -> bool,
    ) -> io::Result<Value> {
        let started_at = Instant::now();
        loop {
            let tool_output = self.call_skill_tool(tool_name, arguments.clone())?;
            if is_done(&tool_output) {
                return Ok(tool_output);
            }
            if started_at.elapsed() > TOOL_WAIT {
                return Err(io::Error::other(format!(
                    "{tool_name} never answered as expected: {tool_output}"
                )));
            }
            std::thread::sleep(Duration::from_millis(200));
        }
    }
}

fn exchange_smtp_line(reader: &mut BufReader<TcpStream>, line: Option<&str>) -> io::Result<()> {
    if let Some(line) = line {
        reader
            .get_mut()
            .write_all(format!("{line}\r\n").as_bytes())?;
    }
    loop {
        let mut reply_line = String::new();
        reader.read_line(&mut reply_line)?;
        if reply_line.starts_with('4') || reply_line.starts_with('5') {
            return Err(io::Error::other(format!("SMTP refused: {reply_line}")));
        }
        if reply_line.as_bytes().get(3) != Some(&b'-') {
            return Ok(());
        }
    }
}

/// The app's part of the session: it sends an email over SMTP once it is configured.
pub fn send_app_email(
    smtp_addr: &str,
    recipient: &str,
    subject: &str,
    body: &str,
) -> io::Result<()> {
    let mut reader = BufReader::new(TcpStream::connect(smtp_addr)?);
    let recipient_line = format!("RCPT TO:<{recipient}>");
    let message =
        format!("From: app@shop.test\r\nTo: {recipient}\r\nSubject: {subject}\r\n\r\n{body}\r\n.");
    for line in [
        None,
        Some("EHLO app.test"),
        Some("MAIL FROM:<app@shop.test>"),
        Some(recipient_line.as_str()),
        Some("DATA"),
        Some(message.as_str()),
        Some("QUIT"),
    ] {
        exchange_smtp_line(&mut reader, line)?;
    }
    Ok(())
}
