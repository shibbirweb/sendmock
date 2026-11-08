use std::collections::HashMap;
use std::sync::Mutex;

use sendmock_ops::Pop3MailboxMessage;

use super::{Pop3Login, Pop3Mailbox, Pop3MailboxError, Pop3Session};

const FIRST_MESSAGE: &str = "Subject: First\r\n\r\nHello\r\n.dot line\r\n";
const SECOND_MESSAGE: &str =
    "Subject: Second\r\nFrom: shop@app.test\r\n\r\nOne\r\nTwo\r\nThree\r\n";

/// Two messages for any user, recording which were deleted.
#[derive(Default)]
struct FakeMailbox {
    deleted_email_ids: Mutex<Vec<String>>,
    opened_usernames: Mutex<Vec<String>>,
}

impl Pop3Mailbox for FakeMailbox {
    async fn open(&self, username: &str) -> Result<Vec<Pop3MailboxMessage>, Pop3MailboxError> {
        if let Ok(mut opened_usernames) = self.opened_usernames.lock() {
            opened_usernames.push(username.to_owned());
        }
        Ok(vec![
            Pop3MailboxMessage {
                email_id: "01FIRST".to_owned(),
                size_bytes: FIRST_MESSAGE.len() as u64,
            },
            Pop3MailboxMessage {
                email_id: "01SECOND".to_owned(),
                size_bytes: SECOND_MESSAGE.len() as u64,
            },
        ])
    }

    async fn read_message(&self, email_id: &str) -> Result<Vec<u8>, Pop3MailboxError> {
        match email_id {
            "01FIRST" => Ok(FIRST_MESSAGE.as_bytes().to_vec()),
            "01SECOND" => Ok(SECOND_MESSAGE.as_bytes().to_vec()),
            _ => Err(Pop3MailboxError("gone".to_owned())),
        }
    }

    async fn delete_messages(&self, email_ids: &[String]) -> Result<(), Pop3MailboxError> {
        if let Ok(mut deleted_email_ids) = self.deleted_email_ids.lock() {
            deleted_email_ids.extend(email_ids.iter().cloned());
        }
        Ok(())
    }
}

async fn send_lines(
    session: &mut Pop3Session<'_, FakeMailbox>,
    command_lines: &[&str],
) -> Vec<String> {
    let mut replies = Vec::new();
    for command_line in command_lines {
        replies.push(session.handle_line(command_line).await.reply);
    }
    replies
}

fn deleted_ids(fake_mailbox: &FakeMailbox) -> Vec<String> {
    fake_mailbox
        .deleted_email_ids
        .lock()
        .map(|deleted_email_ids| deleted_email_ids.clone())
        .unwrap_or_default()
}

// AC: EM-21.1
#[tokio::test]
async fn reading_commands_answer_after_sign_in_and_refuse_before_it() {
    let (fake_mailbox, login) = (FakeMailbox::default(), Pop3Login::AcceptAny);
    let mut session = Pop3Session::new(&fake_mailbox, &login);

    let replies = send_lines(
        &mut session,
        &[
            "CAPA",
            "STAT",
            "USER shop",
            "PASS any",
            "STAT",
            "LIST",
            "UIDL 2",
            "NOOP",
            "XYZZY",
        ],
    )
    .await;

    assert!(replies[0].starts_with("+OK capability list follows\r\nTOP\r\nUSER\r\nUIDL"));
    assert_eq!(replies[1], "-ERR sign in first\r\n");
    assert_eq!(replies[3], "+OK signed in, 2 messages\r\n");
    let total_size = FIRST_MESSAGE.len() + SECOND_MESSAGE.len();
    assert_eq!(replies[4], format!("+OK 2 {total_size}\r\n"));
    assert_eq!(
        replies[5],
        format!(
            "+OK\r\n1 {}\r\n2 {}\r\n.\r\n",
            FIRST_MESSAGE.len(),
            SECOND_MESSAGE.len()
        )
    );
    assert_eq!(replies[6], "+OK 2 01SECOND\r\n");
    assert_eq!(replies[7], "+OK\r\n");
    assert_eq!(replies[8], "-ERR unknown command\r\n");
}

// AC: EM-21.2
#[tokio::test]
async fn a_credentials_file_refuses_wrong_passwords_and_five_failures_close_the_connection() {
    let fake_mailbox = FakeMailbox::default();
    let login = Pop3Login::Credentials(HashMap::from([("shop".to_owned(), "s3cret".to_owned())]));
    let mut session = Pop3Session::new(&fake_mailbox, &login);

    session.handle_line("USER shop").await;
    let mut wrong_password_steps = Vec::new();
    for _ in 0..5 {
        wrong_password_steps.push(session.handle_line("PASS wrong").await);
    }

    assert_eq!(wrong_password_steps[0].reply, "-ERR invalid login\r\n");
    assert!(!wrong_password_steps[3].should_close);
    assert!(wrong_password_steps[4].should_close);
}

// AC: EM-21.3
#[tokio::test]
async fn the_mailbox_is_opened_for_the_signed_in_username() {
    let (fake_mailbox, login) = (FakeMailbox::default(), Pop3Login::AcceptAny);
    let mut session = Pop3Session::new(&fake_mailbox, &login);

    send_lines(&mut session, &["USER shop", "PASS any", "USER blog"]).await;

    let opened_usernames = fake_mailbox
        .opened_usernames
        .lock()
        .map(|opened_usernames| opened_usernames.clone())
        .unwrap_or_default();
    assert_eq!(opened_usernames, ["shop"]);
}

// AC: EM-21.4
#[tokio::test]
async fn retr_sends_the_message_dot_stuffed_and_top_its_headers_and_first_lines() {
    let (fake_mailbox, login) = (FakeMailbox::default(), Pop3Login::AcceptAny);
    let mut session = Pop3Session::new(&fake_mailbox, &login);

    let replies = send_lines(
        &mut session,
        &[
            "USER shop",
            "PASS any",
            "RETR 1",
            "TOP 2 1",
            "TOP 2",
            "RETR 3",
        ],
    )
    .await;

    assert_eq!(
        replies[2],
        format!(
            "+OK {} octets\r\nSubject: First\r\n\r\nHello\r\n..dot line\r\n.\r\n",
            FIRST_MESSAGE.len()
        )
    );
    assert_eq!(
        replies[3],
        "+OK top of message follows\r\nSubject: Second\r\nFrom: shop@app.test\r\n\r\nOne\r\n.\r\n"
    );
    assert!(replies[4].starts_with("-ERR TOP takes"));
    assert_eq!(replies[5], "-ERR no such message\r\n");
}

// AC: EM-21.5
#[tokio::test]
async fn deletions_are_applied_on_quit_and_rset_clears_them() {
    let (fake_mailbox, login) = (FakeMailbox::default(), Pop3Login::AcceptAny);
    let mut session = Pop3Session::new(&fake_mailbox, &login);

    let replies = send_lines(
        &mut session,
        &[
            "USER shop",
            "PASS any",
            "DELE 1",
            "DELE 1",
            "RSET",
            "DELE 2",
            "LIST",
            "STAT",
        ],
    )
    .await;
    let quit_step = session.handle_line("QUIT").await;

    assert_eq!(replies[2], "+OK message 1 deleted\r\n");
    assert_eq!(replies[3], "-ERR no such message\r\n");
    assert_eq!(
        replies[6],
        format!("+OK\r\n1 {}\r\n.\r\n", FIRST_MESSAGE.len())
    );
    assert_eq!(replies[7], format!("+OK 1 {}\r\n", FIRST_MESSAGE.len()));
    assert!(quit_step.should_close);
    assert!(
        quit_step.reply.contains("1 messages deleted"),
        "{}",
        quit_step.reply
    );
    assert_eq!(deleted_ids(&fake_mailbox), ["01SECOND"]);
}

// AC: EM-21.5
#[tokio::test]
async fn a_session_that_ends_without_quit_deletes_nothing() {
    let (fake_mailbox, login) = (FakeMailbox::default(), Pop3Login::AcceptAny);
    let mut session = Pop3Session::new(&fake_mailbox, &login);

    send_lines(&mut session, &["USER shop", "PASS any", "DELE 1"]).await;
    drop(session);

    assert!(deleted_ids(&fake_mailbox).is_empty());
}
