//! The skill's example session, scripted as Claude Code and Codex run it: the MCP server is
//! started from the configuration `sendmock ai install` wrote for the agent, and the agent calls
//! only tools its skill names to configure an app, capture an OTP and set up an inbound webhook.

#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod mcp_session;
    pub mod scripted_agent;
    pub mod sendmock_process;
}

use std::io;
use std::path::Path;

use serde_json::{Value, json};
use support::mcp_session::McpSession;
use support::scripted_agent::{ScriptedAgent, send_app_email};
use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

/// What `sendmock ai install --target <agent>` gives the agent: the arguments its MCP server
/// starts with, and the skill it reads.
struct InstalledAgent {
    mcp_arguments: Vec<String>,
    skill_text: String,
}

fn install_agent(project: &Path, home: &Path, target: &str) -> io::Result<InstalledAgent> {
    let output = run_until_exit(
        sendmock_command(project)
            .env("HOME", home)
            .args(["ai", "install", "--target", target, "--yes"])
            .stdin(std::process::Stdio::null()),
    )?;
    if !output.status.success() {
        return Err(io::Error::other(
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }
    let read_text = |file_path: &Path| std::fs::read_to_string(file_path).unwrap_or_default();
    let mcp_arguments = if target == "codex" {
        let codex_config: toml::Table =
            toml::from_str(&read_text(&home.join(".codex/config.toml")))
                .map_err(io::Error::other)?;
        let arguments = codex_config
            .get("mcp_servers")
            .and_then(|servers| servers.get("sendmock"))
            .and_then(|server| server.get("args"))
            .cloned()
            .ok_or_else(|| io::Error::other("no [mcp_servers.sendmock] args"))?;
        serde_json::to_value(arguments).map_err(io::Error::other)?
    } else {
        let mcp_config: Value = serde_json::from_str(&read_text(&project.join(".mcp.json")))
            .map_err(io::Error::other)?;
        mcp_config["mcpServers"]["sendmock"]["args"].clone()
    };
    let skill_text = if target == "codex" {
        read_text(&project.join("AGENTS.md"))
    } else {
        read_text(&project.join(".claude/skills/sendmock/SKILL.md"))
    };
    Ok(InstalledAgent {
        mcp_arguments: serde_json::from_value(mcp_arguments).map_err(io::Error::other)?,
        skill_text,
    })
}

/// Starts the agent's MCP server as its configuration says, pointed at this test's SendMock,
/// and reads the full skill through it when the agent's own file only points there.
fn start_agent(
    working_directory: &Path,
    http_addr: &str,
    installed: InstalledAgent,
) -> io::Result<ScriptedAgent> {
    assert_eq!(
        installed.mcp_arguments.first().map(String::as_str),
        Some("mcp")
    );
    let extra_arguments: Vec<&str> = installed.mcp_arguments[1..]
        .iter()
        .map(String::as_str)
        .collect();
    let mut mcp_session = McpSession::start(working_directory, http_addr, &extra_arguments)?;
    let skill_resource =
        mcp_session.request("resources/read", json!({ "uri": "sendmock://docs/skill" }))?;
    let skill_text = format!(
        "{}\n{}",
        installed.skill_text,
        skill_resource["contents"][0]["text"]
            .as_str()
            .unwrap_or_default()
    );
    Ok(ScriptedAgent::new(mcp_session, skill_text))
}

/// "Connect an app": the snippet's port is where the app sends, and the email arrives.
fn connect_the_app(agent: &mut ScriptedAgent) -> io::Result<String> {
    agent.call_skill_tool("sendmock_status", json!({ "view": "info" }))?;
    let snippet = agent.call_skill_tool(
        "sendmock_integration_snippet",
        json!({ "stack": "laravel", "channel": "email" }),
    )?;
    let snippet_text = snippet.to_string();
    let smtp_port = snippet_text
        .split("MAIL_PORT=")
        .nth(1)
        .map(|rest| {
            rest.chars()
                .take_while(char::is_ascii_digit)
                .collect::<String>()
        })
        .ok_or_else(|| io::Error::other(format!("no MAIL_PORT in {snippet_text}")))?;
    let smtp_addr = format!("127.0.0.1:{smtp_port}");
    send_app_email(
        &smtp_addr,
        "sam@example.test",
        "Welcome to Shop",
        "Thanks for signing up.",
    )?;
    let latest =
        agent.call_skill_tool("sendmock_email_latest", json!({ "to": "sam@example.test" }))?;
    assert_eq!(latest["subject"], "Welcome to Shop", "{latest}");
    Ok(smtp_addr)
}

/// "Read an OTP or a link": wait for the email, then read its code.
fn capture_an_otp(agent: &mut ScriptedAgent, smtp_addr: &str) -> io::Result<()> {
    send_app_email(
        smtp_addr,
        "user@example.test",
        "Your sign-in code",
        "Your code is 482913.",
    )?;
    agent.call_skill_tool(
        "sendmock_email_wait",
        json!({ "to": "user@example.test", "timeout": "10s" }),
    )?;
    let otp = agent.call_skill_tool("sendmock_otp_get", json!({ "to": "user@example.test" }))?;
    assert_eq!(otp["code"], "482913", "{otp}");
    Ok(())
}

fn build_endpoint_input(endpoint_url: &str) -> Value {
    json!({
        "name": "App inbound mail", "url": endpoint_url, "method": "POST",
        "headers": {}, "extra_fields": {}, "template_id": "postmark.inbound",
        "template_mode": "linked", "timeout_ms": 10_000,
        "retry_policy": { "max_attempts": 1, "backoff_seconds": [1], "retry_on_client_errors": false },
        "is_enabled": true, "query_params": [], "body_mode": "template", "body_fields": [],
        "fields_encoding": "json", "raw_content_type": "application/json", "raw_body": "",
        "render_mode": "strict",
    })
}

/// "Receive provider webhooks in the app": Postmark's inbound format, a rule, a delivery.
fn set_up_an_inbound_webhook(
    agent: &mut ScriptedAgent,
    http_addr: &str,
    smtp_addr: &str,
) -> io::Result<()> {
    let templates = agent.call_skill_tool("sendmock_webhook_template_list", json!({}))?;
    assert!(
        templates.to_string().contains("postmark.inbound"),
        "{templates}"
    );
    let endpoint_url = format!("http://{http_addr}/catch/app-inbound");
    let endpoint = agent.call_skill_tool(
        "sendmock_webhook_endpoint_create",
        build_endpoint_input(&endpoint_url),
    )?;
    agent.call_skill_tool(
        "sendmock_webhook_rule_create",
        json!({ "name": "Support inbox", "endpoint_id": endpoint["id"], "events": ["email.received"], "is_enabled": true }),
    )?;
    send_app_email(
        smtp_addr,
        "support@shop.test",
        "Order arrived damaged",
        "Can I get a replacement?",
    )?;
    let deliveries = agent.call_until(
        "sendmock_webhook_delivery_list",
        &json!({ "endpoint_id": endpoint["id"] }),
        |deliveries| deliveries["items"][0]["status"] == "succeeded",
    )?;
    let delivery = agent.call_skill_tool(
        "sendmock_webhook_delivery_get",
        json!({ "delivery_id": deliveries["items"][0]["id"] }),
    )?;
    assert!(
        delivery.to_string().contains("Order arrived damaged"),
        "{delivery}"
    );
    Ok(())
}

fn run_example_session(target: &str) -> io::Result<Vec<String>> {
    let (project, home) = (tempfile::tempdir()?, tempfile::tempdir()?);
    let installed = install_agent(project.path(), home.path(), target)?;
    let sendmock = SendmockProcess::start_with_free_port(project.path())?;
    let http_addr = sendmock.wait_for_http_addr();
    let mut agent = start_agent(project.path(), &http_addr, installed)?;
    let smtp_addr = connect_the_app(&mut agent)?;
    capture_an_otp(&mut agent, &smtp_addr)?;
    set_up_an_inbound_webhook(&mut agent, &http_addr, &smtp_addr)?;
    Ok(agent.called_tools)
}

// AC: AI-05.3
#[test]
fn claude_code_completes_the_example_session_with_only_the_skill_and_tools() -> io::Result<()> {
    let called_tools = run_example_session("claude-code")?;

    assert!(
        called_tools.contains(&"sendmock_otp_get".to_owned()),
        "{called_tools:?}"
    );
    assert!(called_tools.contains(&"sendmock_webhook_rule_create".to_owned()));
    Ok(())
}

// AC: AI-05.3
#[test]
fn codex_completes_the_example_session_with_only_the_skill_and_tools() -> io::Result<()> {
    let called_tools = run_example_session("codex")?;

    assert!(
        called_tools.contains(&"sendmock_integration_snippet".to_owned()),
        "{called_tools:?}"
    );
    assert!(called_tools.contains(&"sendmock_webhook_delivery_get".to_owned()));
    Ok(())
}
