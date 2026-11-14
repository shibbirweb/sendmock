use std::collections::BTreeSet;

use sendmock_ops::Pop3MailboxMessage;

use super::pop3_command::Pop3Command;
use super::pop3_login::Pop3Login;
use super::pop3_mailbox::Pop3Mailbox;
use super::pop3_message_text::{split_message_lines, take_top_lines, write_multiline_body};

/// Like Mailpit's, a client that fails this many logins is disconnected.
const MAX_FAILED_LOGINS: u8 = 5;
const CAPABILITIES: &str =
    "+OK capability list follows\r\nTOP\r\nUSER\r\nUIDL\r\nIMPLEMENTATION SendMock\r\n.\r\n";

/// What to send back for one line, and whether the connection ends after it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionStep {
    pub reply: String,
    pub should_close: bool,
}

impl SessionStep {
    fn reply(reply_text: impl Into<String>) -> Self {
        Self {
            reply: reply_text.into(),
            should_close: false,
        }
    }

    fn line(status_line: &str) -> Self {
        Self::reply(format!("{status_line}\r\n"))
    }

    fn closing(status_line: &str) -> Self {
        Self {
            reply: format!("{status_line}\r\n"),
            should_close: true,
        }
    }
}

/// RFC 1939's states: signing in, then reading with a mailbox fixed at login.
enum SessionState {
    Authorization {
        username: Option<String>,
    },
    Transaction {
        messages: Vec<Pop3MailboxMessage>,
        marked_numbers: BTreeSet<usize>,
    },
}

/// One POP3 connection's conversation, independent of the socket.
pub struct Pop3Session<'server, Mailbox: Pop3Mailbox> {
    mailbox: &'server Mailbox,
    login: &'server Pop3Login,
    state: SessionState,
    failed_login_count: u8,
}

impl<'server, Mailbox: Pop3Mailbox> Pop3Session<'server, Mailbox> {
    pub fn new(mailbox: &'server Mailbox, login: &'server Pop3Login) -> Self {
        Self {
            mailbox,
            login,
            state: SessionState::Authorization { username: None },
            failed_login_count: 0,
        }
    }

    pub fn greeting() -> String {
        "+OK SendMock POP3 server ready\r\n".to_owned()
    }

    pub async fn handle_line(&mut self, command_line: &str) -> SessionStep {
        let command = Pop3Command::parse(command_line);
        match command.keyword.as_str() {
            "CAPA" => SessionStep::reply(CAPABILITIES),
            "NOOP" => SessionStep::line("+OK"),
            "QUIT" => self.quit().await,
            "USER" | "PASS" => self.sign_in(&command).await,
            "STAT" | "LIST" | "UIDL" | "RETR" | "TOP" | "DELE" | "RSET" => {
                self.read_mailbox(&command).await
            }
            _ => SessionStep::line("-ERR unknown command"),
        }
    }

    async fn sign_in(&mut self, command: &Pop3Command) -> SessionStep {
        let SessionState::Authorization { username } = &mut self.state else {
            return SessionStep::line("-ERR already signed in");
        };
        if command.keyword == "USER" {
            return match command.arguments.as_slice() {
                [given_username] => {
                    *username = Some(given_username.clone());
                    SessionStep::line("+OK")
                }
                _ => SessionStep::line("-ERR USER takes one name"),
            };
        }
        let Some(signing_in_user) = username.clone() else {
            return SessionStep::line("-ERR send USER first");
        };
        let password = command.arguments.join(" ");
        if !self.login.accepts_password(&signing_in_user, &password) {
            return self.refuse_login();
        }
        match self.mailbox.open(&signing_in_user).await {
            Ok(messages) => {
                let message_count = messages.len();
                self.state = SessionState::Transaction {
                    messages,
                    marked_numbers: BTreeSet::new(),
                };
                SessionStep::line(&format!("+OK signed in, {message_count} messages"))
            }
            Err(mailbox_error) => {
                tracing::warn!(error = %mailbox_error, "could not open a POP3 mailbox");
                SessionStep::line("-ERR the mailbox could not be opened")
            }
        }
    }

    fn refuse_login(&mut self) -> SessionStep {
        self.failed_login_count += 1;
        if self.failed_login_count >= MAX_FAILED_LOGINS {
            return SessionStep::closing("-ERR too many failed logins");
        }
        SessionStep::line("-ERR invalid login")
    }

    async fn read_mailbox(&mut self, command: &Pop3Command) -> SessionStep {
        let SessionState::Transaction {
            messages,
            marked_numbers,
        } = &mut self.state
        else {
            return SessionStep::line("-ERR sign in first");
        };
        let mailbox_view = MailboxView {
            messages,
            marked_numbers,
        };
        match command.keyword.as_str() {
            "STAT" => mailbox_view.stat(),
            "LIST" => mailbox_view.list(command),
            "UIDL" => mailbox_view.uidl(command),
            "RETR" | "TOP" => mailbox_view.send_message(self.mailbox, command).await,
            "DELE" => match mailbox_view.find_number(command.read_number(0)) {
                Some(message_number) => {
                    marked_numbers.insert(message_number);
                    SessionStep::line(&format!("+OK message {message_number} deleted"))
                }
                None => SessionStep::line("-ERR no such message"),
            },
            _ => {
                marked_numbers.clear();
                SessionStep::line("+OK")
            }
        }
    }

    /// QUIT applies the deletions (RFC 1939's UPDATE state); outside a mailbox it only says
    /// goodbye. A connection that drops without QUIT never gets here, so nothing is deleted.
    async fn quit(&mut self) -> SessionStep {
        let SessionState::Transaction {
            messages,
            marked_numbers,
        } = &self.state
        else {
            return SessionStep::closing("+OK SendMock POP3 server signing off");
        };
        let marked_email_ids: Vec<String> = marked_numbers
            .iter()
            .filter_map(|message_number| messages.get(message_number - 1))
            .map(|message| message.email_id.clone())
            .collect();
        match self.mailbox.delete_messages(&marked_email_ids).await {
            Ok(()) => SessionStep::closing(&format!(
                "+OK SendMock POP3 server signing off ({} messages deleted)",
                marked_email_ids.len()
            )),
            Err(mailbox_error) => {
                tracing::warn!(error = %mailbox_error, "could not delete POP3 messages");
                SessionStep::closing("-ERR some deleted messages were not removed")
            }
        }
    }
}

/// The mailbox fixed at login and the numbers marked for deletion, which no command shows.
struct MailboxView<'session> {
    messages: &'session [Pop3MailboxMessage],
    marked_numbers: &'session BTreeSet<usize>,
}

impl MailboxView<'_> {
    fn find_number(&self, message_number: Option<usize>) -> Option<usize> {
        message_number.filter(|message_number| {
            *message_number <= self.messages.len() && !self.marked_numbers.contains(message_number)
        })
    }

    fn visible_messages(&self) -> impl Iterator<Item = (usize, &Pop3MailboxMessage)> {
        self.messages
            .iter()
            .enumerate()
            .map(|(message_index, message)| (message_index + 1, message))
            .filter(|(message_number, _)| !self.marked_numbers.contains(message_number))
    }

    fn stat(&self) -> SessionStep {
        let (message_count, total_size_bytes) = self
            .visible_messages()
            .fold((0, 0), |(count, total), (_, message)| {
                (count + 1, total + message.size_bytes)
            });
        SessionStep::line(&format!("+OK {message_count} {total_size_bytes}"))
    }

    fn list(&self, command: &Pop3Command) -> SessionStep {
        self.answer_listing(command, |message| message.size_bytes.to_string())
    }

    fn uidl(&self, command: &Pop3Command) -> SessionStep {
        self.answer_listing(command, |message| message.email_id.clone())
    }

    /// LIST and UIDL: one message's line, or every visible message's.
    fn answer_listing(
        &self,
        command: &Pop3Command,
        describe: impl Fn(&Pop3MailboxMessage) -> String,
    ) -> SessionStep {
        if command.arguments.is_empty() {
            let listing: String = self
                .visible_messages()
                .map(|(message_number, message)| {
                    format!("{message_number} {}\r\n", describe(message))
                })
                .collect();
            return SessionStep::reply(format!("+OK\r\n{listing}.\r\n"));
        }
        match self.find_number(command.read_number(0)) {
            Some(message_number) => SessionStep::line(&format!(
                "+OK {message_number} {}",
                describe(&self.messages[message_number - 1])
            )),
            None => SessionStep::line("-ERR no such message"),
        }
    }

    async fn send_message(&self, mailbox: &impl Pop3Mailbox, command: &Pop3Command) -> SessionStep {
        let Some(message_number) = self.find_number(command.read_number(0)) else {
            return SessionStep::line("-ERR no such message");
        };
        let top_line_count = if command.keyword == "TOP" {
            match command
                .arguments
                .get(1)
                .and_then(|line_count| line_count.parse::<usize>().ok())
            {
                Some(top_line_count) => Some(top_line_count),
                None => {
                    return SessionStep::line("-ERR TOP takes a message number and a line count");
                }
            }
        } else {
            None
        };
        let message = &self.messages[message_number - 1];
        let raw_message = match mailbox.read_message(&message.email_id).await {
            Ok(raw_message) => raw_message,
            Err(mailbox_error) => {
                tracing::warn!(error = %mailbox_error, "could not read a POP3 message");
                return SessionStep::line("-ERR no such message");
            }
        };
        let message_text = String::from_utf8_lossy(&raw_message);
        let message_lines = split_message_lines(&message_text);
        match top_line_count {
            Some(top_line_count) => SessionStep::reply(format!(
                "+OK top of message follows\r\n{}",
                write_multiline_body(&take_top_lines(&message_lines, top_line_count))
            )),
            None => SessionStep::reply(format!(
                "+OK {} octets\r\n{}",
                message.size_bytes,
                write_multiline_body(&message_lines)
            )),
        }
    }
}
