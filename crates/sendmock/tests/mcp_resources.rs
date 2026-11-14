#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod mcp_session;
    pub mod sendmock_process;
}

use std::io;
use std::time::Duration;

use serde_json::{Value, json};
use support::mcp_session::McpSession;
use support::sendmock_process::SendmockProcess;

fn start_session(working_directory: &std::path::Path) -> io::Result<(SendmockProcess, McpSession)> {
    let sendmock = SendmockProcess::start_with_free_port(working_directory)?;
    let mcp_session = McpSession::start(working_directory, &sendmock.wait_for_http_addr(), &[])?;
    Ok((sendmock, mcp_session))
}

fn read_text(read_result: &Value) -> String {
    read_result["contents"][0]["text"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

// AC: AI-03.1
#[test]
fn every_documented_resource_is_listed_and_reads_its_content() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let (_sendmock, mut mcp_session) = start_session(working_directory.path())?;
    let sent = mcp_session.call_tool(
        "sendmock_email_send",
        json!({ "from": "app@shop.test", "to": ["sam@example.test"], "subject": "Receipt", "text": "Thanks for your order." }),
    )?;
    let email_id = sent["structuredContent"]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    let resources = mcp_session.request("resources/list", json!({}))?;
    let templates = mcp_session.request("resources/templates/list", json!({}))?;
    let skill = mcp_session.request("resources/read", json!({ "uri": "sendmock://docs/skill" }))?;
    let email = mcp_session.request(
        "resources/read",
        json!({ "uri": format!("sendmock://emails/{email_id}") }),
    )?;
    let raw = mcp_session.request(
        "resources/read",
        json!({ "uri": format!("sendmock://emails/{email_id}/raw") }),
    )?;

    let resource_uris: Vec<&str> = resources["resources"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|resource| resource["uri"].as_str())
        .collect();
    let template_uris: Vec<&str> = templates["resourceTemplates"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|template| template["uriTemplate"].as_str())
        .collect();
    assert!(
        resource_uris.contains(&"sendmock://docs/skill"),
        "{resource_uris:?}"
    );
    assert!(resource_uris.contains(&"sendmock://emails"));
    assert!(
        template_uris.contains(&"sendmock://emails/{emailId}/raw"),
        "{template_uris:?}"
    );
    assert!(template_uris.contains(&"sendmock://webhooks/deliveries/{deliveryId}"));
    assert!(read_text(&skill).starts_with("---\nname: sendmock"));
    assert!(
        read_text(&email).contains("\"subject\": \"Receipt\""),
        "{email}"
    );
    assert!(read_text(&raw).contains("Subject: Receipt"), "{raw}");
    Ok(())
}

// AC: AI-03.1
#[test]
fn a_long_body_comes_back_as_a_resource_link() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let (_sendmock, mut mcp_session) = start_session(working_directory.path())?;
    let long_html = format!("<p>{}</p>", "Order line. ".repeat(800));
    let sent = mcp_session.call_tool(
        "sendmock_email_send",
        json!({ "from": "app@shop.test", "to": ["sam@example.test"], "subject": "Long", "text": "Hi", "html": long_html }),
    )?;
    let email_id = sent["structuredContent"]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    let got = mcp_session.call_tool("sendmock_email_get", json!({ "email_id": email_id }))?;

    let content = got["content"].as_array().cloned().unwrap_or_default();
    let resource_link = content
        .iter()
        .find(|content_block| content_block["type"] == "resource_link");
    assert_eq!(
        resource_link.map(|link| link["uri"].clone()),
        Some(json!(format!("sendmock://emails/{email_id}"))),
        "{got}"
    );
    let inline_text = content[0]["text"].as_str().unwrap_or_default();
    assert!(
        inline_text.len() < 6_000,
        "{} characters inline",
        inline_text.len()
    );
    assert!(inline_text.contains("read the resource sendmock://emails/"));
    Ok(())
}

// AC: AI-03.2
#[test]
fn a_subscribed_list_hears_of_a_new_sms() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let (_sendmock, mut mcp_session) = start_session(working_directory.path())?;
    mcp_session.request("resources/subscribe", json!({ "uri": "sendmock://sms" }))?;
    std::thread::sleep(Duration::from_millis(800));

    mcp_session.call_tool(
        "sendmock_sms_send",
        json!({ "from": "+15550001111", "to": "+15550002222", "body": "Hello" }),
    )?;
    std::thread::sleep(Duration::from_secs(2));
    let notifications = mcp_session.collect_notifications()?;

    assert!(
        notifications
            .iter()
            .any(
                |notification| notification["method"] == "notifications/resources/updated"
                    && notification["params"]["uri"] == "sendmock://sms"
            ),
        "{notifications:?}"
    );
    Ok(())
}

// AC: AI-03.3
#[test]
fn every_prompt_is_listed_and_returns_its_workflow() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let (_sendmock, mut mcp_session) = start_session(working_directory.path())?;

    let prompts = mcp_session.request("prompts/list", json!({}))?;
    let prompt = mcp_session.request(
        "prompts/get",
        json!({ "name": "test-otp-flow", "arguments": { "recipient": "sam@example.test" } }),
    )?;

    let prompt_names: Vec<&str> = prompts["prompts"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|listed| listed["name"].as_str())
        .collect();
    assert_eq!(prompt_names.len(), 10, "{prompt_names:?}");
    assert!(prompt_names.contains(&"add-payment-gateway"));
    let message_text = prompt["messages"][0]["content"]["text"]
        .as_str()
        .unwrap_or_default();
    assert!(message_text.contains("sam@example.test"), "{prompt}");
    assert!(message_text.contains("sendmock_otp_get"));
    Ok(())
}
