#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod mcp_session;
    pub mod sendmock_process;
}

use std::io;

use serde_json::{Value, json};
use support::mcp_session::McpSession;
use support::sendmock_process::SendmockProcess;

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

#[test]
fn the_sms_and_verify_tools_send_an_sms_and_keep_provider_secrets_masked() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let mut mcp_session = McpSession::start(
        working_directory.path(),
        &sendmock.wait_for_http_addr(),
        &["--toolsets", "sms,verify,numbers,extract"],
    )?;

    let tools = mcp_session.list_tools()?;
    let send_result = mcp_session.call_tool(
        "sendmock_sms_send",
        json!({ "from": "+15550001111", "to": "+8801700000000", "body": "Your code is 482913" }),
    )?;
    let otp_result = mcp_session.call_tool(
        "sendmock_otp_get",
        json!({ "to": "+8801700000000", "channel": "sms" }),
    )?;
    let service_result = mcp_session.call_tool(
        "sendmock_verify_service_create",
        json!({ "friendly_name": "Shop", "code_length": 6, "fixed_code": "123456", "ttl_seconds": 600 }),
    )?;
    let provider_result = mcp_session.call_tool(
        "sendmock_sms_provider_get",
        json!({ "provider_key": "twilio" }),
    )?;

    assert_eq!(send_result["structuredContent"]["segments"], 1);
    assert_eq!(otp_result["structuredContent"]["code"], "482913");
    assert_eq!(service_result["structuredContent"]["fixed_code"], "123456");
    assert!(find_tool(&tools, "sendmock_number_list").is_some());
    assert!(!provider_result.to_string().contains("twilio-test-token"));
    assert!(tools.iter().all(|tool| {
        !tool["name"]
            .as_str()
            .is_some_and(|name| name.contains("credential"))
    }));
    Ok(())
}

/// Reading tools are read-only and the ones that make or change a payment are not; the
/// toolset holds payment tools only.
fn assert_payment_annotations(tools: &[Value]) {
    let read_only_hint = |tool_name: &str| {
        find_tool(tools, tool_name).map(|tool| tool["annotations"]["readOnlyHint"].clone())
    };

    for read_only_tool in [
        "sendmock_payment_list",
        "sendmock_payment_get",
        "sendmock_payment_wait",
    ] {
        assert_eq!(
            read_only_hint(read_only_tool),
            Some(json!(true)),
            "{read_only_tool}"
        );
    }
    for changing_tool in [
        "sendmock_payment_create_checkout",
        "sendmock_payment_simulate",
        "sendmock_payment_notify",
    ] {
        assert_eq!(
            read_only_hint(changing_tool),
            Some(json!(false)),
            "{changing_tool}"
        );
    }
    assert!(tools.iter().all(|tool| {
        tool["name"].as_str().is_some_and(|name| {
            name.starts_with("sendmock_payment_") || name.starts_with("sendmock_checkout_")
        })
    }));
}

// AC: PY-11.2
#[test]
fn the_payments_toolset_makes_settles_waits_for_and_reads_a_payment() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let mut mcp_session = McpSession::start(
        working_directory.path(),
        &sendmock.wait_for_http_addr(),
        &["--toolsets", "payments"],
    )?;

    let tools = mcp_session.list_tools()?;
    let checkout_result = mcp_session.call_tool(
        "sendmock_payment_create_checkout",
        json!({ "provider": "stripe", "amount_minor": 1999, "currency": "USD" }),
    )?;
    let payment_id = checkout_result["structuredContent"]["id"].clone();
    let simulate_result = mcp_session.call_tool(
        "sendmock_payment_simulate",
        json!({ "payment_id": payment_id, "action": "succeed" }),
    )?;
    let wait_result = mcp_session.call_tool(
        "sendmock_payment_wait",
        json!({ "provider": "stripe", "status": "succeeded", "timeout": "5s" }),
    )?;
    let get_result =
        mcp_session.call_tool("sendmock_payment_get", json!({ "payment_id": payment_id }))?;
    let notify_result = mcp_session.call_tool(
        "sendmock_payment_notify",
        json!({ "payment_id": payment_id }),
    )?;
    assert_payment_annotations(&tools);
    assert_eq!(simulate_result["structuredContent"]["status"], "succeeded");
    assert_eq!(wait_result["structuredContent"]["id"], payment_id);
    assert_eq!(get_result["structuredContent"]["status"], "succeeded");
    assert_eq!(notify_result["isError"], json!(true));
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

// AC: EM-12.4
#[test]
fn tags_are_added_and_removed_through_mcp() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let sendmock = SendmockProcess::start_with_free_port(working_directory.path())?;
    let mut mcp_session = McpSession::start(
        working_directory.path(),
        &sendmock.wait_for_http_addr(),
        &[],
    )?;
    let send_result = mcp_session.call_tool(
        "sendmock_email_send",
        json!({ "from": "app@shop.test", "to": ["sam@example.test"], "subject": "Tags", "text": "Hello" }),
    )?;
    let email_id = send_result["structuredContent"]["id"].clone();

    let tagged = mcp_session.call_tool(
        "sendmock_email_update",
        json!({ "email_id": email_id, "tags": ["signup", "qa"] }),
    )?;
    let cleared = mcp_session.call_tool(
        "sendmock_email_update",
        json!({ "email_id": email_id, "tags": [] }),
    )?;

    assert_eq!(tagged["structuredContent"]["tags"], json!(["signup", "qa"]));
    assert_eq!(cleared["structuredContent"]["tags"], json!([]));
    Ok(())
}
