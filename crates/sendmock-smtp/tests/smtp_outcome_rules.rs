#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod smtp_test_client;
    pub mod test_smtp_server;
}

use std::io;

use sendmock_store::EmailOutcomeRuleRecord;
use support::smtp_test_client::{build_test_message, connect, reply_code};
use support::test_smtp_server::TestSmtpServer;

fn reject_rule(pattern: &str) -> EmailOutcomeRuleRecord {
    EmailOutcomeRuleRecord {
        rule_id: "rule-1".to_owned(),
        position: 0,
        pattern: pattern.to_owned(),
        outcome: "reject".to_owned(),
        smtp_code: Some("554 5.7.1".to_owned()),
        diagnostic: Some("relay denied".to_owned()),
        note: String::new(),
        is_enabled: true,
        created_by: "api".to_owned(),
        created_at_unix_ms: 0,
    }
}

// AC: EM-10.5
#[tokio::test]
async fn a_reject_rule_refuses_the_recipient_at_rcpt_and_the_rest_is_delivered() -> io::Result<()> {
    let server = TestSmtpServer::start().await?;
    server
        .operation_context
        .email_outcome_rule_repository
        .insert_rule(reject_rule("*@blocked.test"))
        .await
        .map_err(io::Error::other)?;
    let mut client = connect(server.smtp_addr).await?;
    client.command("EHLO app.test").await?;
    client.command("MAIL FROM:<app@shop.test>").await?;

    let refused_reply = client.command("RCPT TO:<Kim@Blocked.test>").await?;
    let accepted_reply = client.command("RCPT TO:<sam@shop.test>").await?;
    client.command("DATA").await?;
    let data_reply = client
        .command(&format!(
            "{}\r\n.",
            build_test_message("Welcome", "sam@shop.test", Some("kim@blocked.test"))
        ))
        .await?;
    client.command("QUIT").await?;
    let emails = server.list_emails().await?;
    let sessions = server.wait_for_sessions(1).await?;

    assert_eq!(refused_reply, "554 5.7.1 relay denied\r\n");
    assert_eq!(reply_code(&accepted_reply), 250);
    assert_eq!(reply_code(&data_reply), 250);
    assert_eq!(emails.len(), 1);
    assert_eq!(emails[0].envelope_to, ["sam@shop.test"]);
    assert!(
        sessions[0].transcript.contains("S: 554 5.7.1 relay denied"),
        "{}",
        sessions[0].transcript
    );
    Ok(())
}
