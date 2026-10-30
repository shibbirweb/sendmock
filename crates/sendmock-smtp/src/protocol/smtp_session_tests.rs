use std::collections::HashMap;
use std::sync::Arc;

use super::*;

fn settings_with(change: impl FnOnce(&mut SessionSettings)) -> Arc<SessionSettings> {
    let mut settings = SessionSettings {
        hostname: "sendmock.local".to_owned(),
        max_size_bytes: 1024,
        auth_mode: SmtpAuthMode::AcceptAny,
        is_tls_available: true,
        is_tls_required: false,
        recipient_policy: RecipientPolicy::default(),
    };
    change(&mut settings);
    Arc::new(settings)
}

/// The reply code for one line; a recipient check is answered as if no rule refused it.
fn run_line(session: &mut SmtpSession, command_line: &str) -> u16 {
    match session.handle_line(command_line) {
        SessionAction::CheckRecipient(forward_path) => {
            session.finish_recipient(forward_path, None).code
        }
        other_action => other_action.reply().map_or(0, |reply| reply.code),
    }
}

fn run_lines(session: &mut SmtpSession, command_lines: &[&str]) -> Vec<u16> {
    command_lines
        .iter()
        .map(|command_line| run_line(session, command_line))
        .collect()
}

// AC: EM-01.3
#[test]
fn advertises_pipelining_8bitmime_smtputf8_size_starttls_and_auth() {
    let mut session = SmtpSession::new(settings_with(|_| {}));

    let SessionAction::Reply(reply) = session.handle_line("EHLO app.test") else {
        panic!("EHLO answers with a reply");
    };

    assert_eq!(reply.code, 250);
    for capability in [
        "PIPELINING",
        "8BITMIME",
        "SMTPUTF8",
        "SIZE 1024",
        "STARTTLS",
        "AUTH PLAIN LOGIN CRAM-MD5",
    ] {
        assert!(
            reply.lines.iter().any(|line| line == capability),
            "missing {capability}"
        );
    }
}

#[test]
fn takes_a_message_through_mail_rcpt_and_data() {
    let mut session = SmtpSession::new(settings_with(|_| {}));

    let codes = run_lines(
        &mut session,
        &[
            "EHLO app.test",
            "MAIL FROM:<app@shop.test>",
            "RCPT TO:<sam@example.test>",
            "RCPT TO:<audit@shop.test>",
            "DATA",
        ],
    );
    let completion = session.complete_message(42, Ok("01J0EMAIL".to_owned()));

    assert_eq!(codes, [250, 250, 250, 250, 354]);
    assert_eq!(completion.code, 250);
    assert_eq!(session.result(), SessionResult::Delivered);
    assert_eq!(session.email_ids(), ["01J0EMAIL"]);
}

// AC: EM-01.3
#[test]
fn refuses_a_declared_size_over_the_limit() {
    let mut session = SmtpSession::new(settings_with(|_| {}));

    let codes = run_lines(
        &mut session,
        &["EHLO app.test", "MAIL FROM:<app@shop.test> SIZE=4096"],
    );

    assert_eq!(codes, [250, 552]);
    assert_eq!(session.result(), SessionResult::Rejected);
}

// AC: EM-01.6
#[test]
fn answers_commands_out_of_order_and_malformed_ones_with_the_right_codes() {
    let mut session = SmtpSession::new(settings_with(|_| {}));

    let codes = run_lines(
        &mut session,
        &[
            "MAIL FROM:<a@b.test>",
            "HELO",
            "EHLO app.test",
            "RCPT TO:<a@b.test>",
            "DATA",
            "MAIL TO:<a@b.test>",
            "FROB",
            "VRFY sam",
            "NOOP",
        ],
    );

    assert_eq!(codes, [503, 501, 250, 503, 503, 501, 500, 252, 250]);
}

// AC: EM-02.4
#[test]
fn refuses_mail_before_starttls_when_tls_is_required() {
    let mut session = SmtpSession::new(settings_with(|settings| settings.is_tls_required = true));

    let codes = run_lines(
        &mut session,
        &["EHLO app.test", "MAIL FROM:<app@shop.test>", "STARTTLS"],
    );
    session.tls_started(Some("TLSv1.3".to_owned()));
    let after_tls = run_lines(
        &mut session,
        &["EHLO app.test", "MAIL FROM:<app@shop.test>"],
    );

    assert_eq!(codes, [250, 530, 220]);
    assert_eq!(after_tls, [250, 250]);
    assert_eq!(session.tls_version(), Some("TLSv1.3"));
}

// AC: EM-02.3
#[test]
fn accepts_any_credentials_with_plain_login_and_cram_md5() {
    let plain = encode_base64_text("\0anyone\0anything");
    let mut plain_session = SmtpSession::new(settings_with(|_| {}));
    let mut login_session = SmtpSession::new(settings_with(|_| {}));
    let mut cram_session = SmtpSession::new(settings_with(|_| {}));

    let plain_codes = run_lines(
        &mut plain_session,
        &["EHLO a", &format!("AUTH PLAIN {plain}")],
    );
    let login_codes = run_lines(
        &mut login_session,
        &[
            "EHLO a",
            "AUTH LOGIN",
            &encode_base64_text("anyone"),
            &encode_base64_text("anything"),
        ],
    );
    let cram_codes = run_lines(
        &mut cram_session,
        &[
            "EHLO a",
            "AUTH CRAM-MD5",
            &encode_base64_text("anyone 0123"),
        ],
    );

    assert_eq!(plain_codes, [250, 235]);
    assert_eq!(login_codes, [250, 334, 334, 235]);
    assert_eq!(cram_codes, [250, 334, 235]);
    assert_eq!(login_session.auth_user(), Some("anyone"));
    assert!(!login_session.transcript_text().contains("anything"));
}

// AC: EM-02.3
#[test]
fn checks_credentials_from_a_file_and_hides_auth_when_off() {
    let credentials =
        SmtpAuthMode::Credentials(HashMap::from([("app".to_owned(), "secret".to_owned())]));
    let mut file_session =
        SmtpSession::new(settings_with(|settings| settings.auth_mode = credentials));
    let mut disabled_session = SmtpSession::new(settings_with(|settings| {
        settings.auth_mode = SmtpAuthMode::Disabled
    }));

    let wrong_password = encode_base64_text("\0app\0wrong");
    let right_password = encode_base64_text("\0app\0secret");
    let file_codes = run_lines(
        &mut file_session,
        &[
            "EHLO a",
            &format!("AUTH PLAIN {wrong_password}"),
            &format!("AUTH PLAIN {right_password}"),
        ],
    );
    let SessionAction::Reply(ehlo_reply) = disabled_session.handle_line("EHLO a") else {
        panic!("EHLO answers with a reply");
    };
    let disabled_codes = run_lines(&mut disabled_session, &["AUTH PLAIN abc"]);

    assert_eq!(file_codes, [250, 535, 235]);
    assert!(!ehlo_reply.lines.iter().any(|line| line.starts_with("AUTH")));
    assert_eq!(disabled_codes, [502]);
}

#[test]
fn rejects_recipients_outside_the_allowlist() {
    let mut session = SmtpSession::new(settings_with(|settings| {
        settings.recipient_policy = RecipientPolicy::from_glob_list("*@app.test")
    }));

    let codes = run_lines(
        &mut session,
        &[
            "EHLO a",
            "MAIL FROM:<x@y.test>",
            "RCPT TO:<sam@other.test>",
            "RCPT TO:<sam@app.test>",
        ],
    );

    assert_eq!(codes, [250, 250, 550, 250]);
}

#[test]
fn a_session_without_mail_is_aborted() {
    let mut session = SmtpSession::new(settings_with(|_| {}));

    run_lines(&mut session, &["EHLO a", "QUIT"]);

    assert_eq!(session.result(), SessionResult::Aborted);
}

// AC: EM-10.5
#[test]
fn a_refused_recipient_gets_the_rule_reply_and_is_left_out() {
    let mut session = SmtpSession::new(settings_with(|_| {}));
    run_lines(&mut session, &["EHLO a", "MAIL FROM:<x@y.test>"]);

    let SessionAction::CheckRecipient(forward_path) =
        session.handle_line("RCPT TO:<qa@blocked.test>")
    else {
        panic!("a recipient check");
    };
    let refusal_reply = session.finish_recipient(
        forward_path,
        Some(SmtpReply::new(554, "5.7.1 relay denied")),
    );
    let codes = run_lines(&mut session, &["RCPT TO:<sam@app.test>"]);

    assert_eq!(refusal_reply.to_wire(), "554 5.7.1 relay denied\r\n");
    assert_eq!(codes, [250]);
    assert_eq!(
        session.envelope().recipients,
        vec!["sam@app.test".to_owned()]
    );
}
