use std::sync::Arc;

use super::auth_exchange::PendingAuth;
use super::recipient_policy::RecipientPolicy;
use super::session_transcript::SessionTranscript;
use super::smtp_auth::SmtpAuthMode;
use super::smtp_command::{SmtpCommand, parse_smtp_command};
use super::smtp_reply::SmtpReply;

/// The server's side of every session: limits, AUTH, TLS and who may receive mail.
#[derive(Debug, Clone)]
pub struct SessionSettings {
    pub hostname: String,
    pub max_size_bytes: u64,
    pub auth_mode: SmtpAuthMode,
    pub is_tls_available: bool,
    pub is_tls_required: bool,
    pub recipient_policy: RecipientPolicy,
}

/// What the connection should do after a line.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionAction {
    Reply(SmtpReply),
    /// Send the 354 reply, then read the message up to `<CRLF>.<CRLF>`.
    ReceiveData(SmtpReply),
    /// Send the 220 reply, then start TLS on the connection.
    UpgradeToTls(SmtpReply),
    Close(SmtpReply),
    /// Ask the outcome rules about this `RCPT` recipient, then answer through
    /// [`SmtpSession::finish_recipient`].
    CheckRecipient(String),
}

impl SessionAction {
    /// The reply to send now; `None` for a recipient check, which is answered once finished.
    pub fn reply(&self) -> Option<&SmtpReply> {
        match self {
            Self::Reply(reply)
            | Self::ReceiveData(reply)
            | Self::UpgradeToTls(reply)
            | Self::Close(reply) => Some(reply),
            Self::CheckRecipient(_) => None,
        }
    }
}

/// How a session ended, as the session log records it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionResult {
    Delivered,
    Rejected,
    Aborted,
}

/// One SMTP session's protocol state, with no I/O, so every command and limit is testable.
#[derive(Debug)]
pub struct SmtpSession {
    pub(super) settings: Arc<SessionSettings>,
    pub(super) helo_name: Option<String>,
    pub(super) is_tls_active: bool,
    pub(super) tls_version: Option<String>,
    pub(super) mail_from: Option<String>,
    pub(super) recipients: Vec<String>,
    pub(super) pending_auth: Option<PendingAuth>,
    pub(super) auth_user: Option<String>,
    pub(super) auth_mechanism: Option<String>,
    pub(super) transcript: SessionTranscript,
    pub(super) email_ids: Vec<String>,
    pub(super) failure_reason: Option<String>,
    pub(super) connection_problem: Option<String>,
}

impl SmtpSession {
    pub fn new(settings: Arc<SessionSettings>) -> Self {
        Self {
            settings,
            helo_name: None,
            is_tls_active: false,
            tls_version: None,
            mail_from: None,
            recipients: Vec::new(),
            pending_auth: None,
            auth_user: None,
            auth_mechanism: None,
            transcript: SessionTranscript::default(),
            email_ids: Vec::new(),
            failure_reason: None,
            connection_problem: None,
        }
    }

    pub fn greeting(&mut self) -> SmtpReply {
        self.reply(
            220,
            &format!("{} SendMock ESMTP ready", self.settings.hostname),
        )
    }

    pub fn handle_line(&mut self, command_line: &str) -> SessionAction {
        if let Some(pending_auth) = self.pending_auth.take() {
            return SessionAction::Reply(self.continue_auth(pending_auth, command_line));
        }
        let command = parse_smtp_command(command_line);
        match &command {
            SmtpCommand::Auth {
                mechanism,
                initial_response,
            } => {
                self.transcript
                    .record_auth_command(mechanism, initial_response.is_some());
            }
            _ => self.transcript.record_client_line(command_line),
        }
        self.dispatch(command)
    }

    fn dispatch(&mut self, command: SmtpCommand) -> SessionAction {
        let reply = match command {
            SmtpCommand::Hello {
                is_extended,
                client_name,
            } => self.greet_client(is_extended, client_name),
            SmtpCommand::Mail {
                reverse_path,
                declared_size,
            } => self.start_mail(reverse_path, declared_size),
            SmtpCommand::Recipient { forward_path } => return self.start_recipient(forward_path),
            SmtpCommand::Data if self.recipients.is_empty() => {
                self.reply(503, "Send RCPT TO before DATA")
            }
            SmtpCommand::Data => {
                return SessionAction::ReceiveData(
                    self.reply(354, "End data with <CR><LF>.<CR><LF>"),
                );
            }
            SmtpCommand::Reset => {
                self.reset_transaction();
                self.reply(250, "OK")
            }
            SmtpCommand::Noop => self.reply(250, "OK"),
            SmtpCommand::Verify => self.reply(252, "Cannot verify, but will accept the message"),
            SmtpCommand::StartTls => return self.start_tls(),
            SmtpCommand::Auth {
                mechanism,
                initial_response,
            } => self.start_auth(&mechanism, initial_response),
            SmtpCommand::Quit => return SessionAction::Close(self.reply(221, "Bye")),
            SmtpCommand::InvalidArguments(reason) => self.reply(501, reason),
            SmtpCommand::Unknown => self.reply(500, "Command not recognised"),
        };
        SessionAction::Reply(reply)
    }

    fn greet_client(&mut self, is_extended: bool, client_name: String) -> SmtpReply {
        self.helo_name = Some(client_name);
        self.reset_transaction();
        if !is_extended {
            return self.reply(250, &self.settings.hostname.clone());
        }
        let mut capabilities = vec![
            format!("{} greets you", self.settings.hostname),
            "PIPELINING".to_owned(),
            "8BITMIME".to_owned(),
            "SMTPUTF8".to_owned(),
            format!("SIZE {}", self.settings.max_size_bytes),
        ];
        if self.settings.is_tls_available && !self.is_tls_active {
            capabilities.push("STARTTLS".to_owned());
        }
        if self.settings.auth_mode.is_offered() {
            capabilities.push("AUTH PLAIN LOGIN CRAM-MD5".to_owned());
        }
        self.multiline_reply(250, capabilities)
    }

    fn start_mail(&mut self, reverse_path: String, declared_size: Option<u64>) -> SmtpReply {
        if self.helo_name.is_none() {
            return self.reply(503, "Send EHLO or HELO first");
        }
        if self.settings.is_tls_required && !self.is_tls_active {
            return self.reject(530, "Must issue a STARTTLS command first");
        }
        if self.mail_from.is_some() {
            return self.reply(503, "A message is already started; send RSET to start over");
        }
        if declared_size.is_some_and(|size_bytes| size_bytes > self.settings.max_size_bytes) {
            return self.reject(
                552,
                &format!(
                    "Message size exceeds the {} byte limit",
                    self.settings.max_size_bytes
                ),
            );
        }
        self.mail_from = Some(reverse_path);
        self.reply(250, "OK")
    }

    fn start_recipient(&mut self, forward_path: String) -> SessionAction {
        if self.mail_from.is_none() {
            return SessionAction::Reply(self.reply(503, "Send MAIL FROM before RCPT TO"));
        }
        if !self.settings.recipient_policy.is_allowed(&forward_path) {
            return SessionAction::Reply(
                self.reject(550, &format!("No such user: {forward_path}")),
            );
        }
        SessionAction::CheckRecipient(forward_path)
    }

    /// Answers a `RCPT` once the outcome rules were asked: the rule's refusal, or accepted.
    pub fn finish_recipient(
        &mut self,
        forward_path: String,
        refusal: Option<SmtpReply>,
    ) -> SmtpReply {
        if let Some(refusal) = refusal {
            return self.reject(refusal.code, &refusal.lines.join(" "));
        }
        self.recipients.push(forward_path);
        self.reply(250, "OK")
    }

    fn start_tls(&mut self) -> SessionAction {
        if self.is_tls_active {
            return SessionAction::Reply(self.reply(503, "TLS is already active"));
        }
        if !self.settings.is_tls_available {
            return SessionAction::Reply(self.reply(454, "TLS not available"));
        }
        SessionAction::UpgradeToTls(self.reply(220, "Ready to start TLS"))
    }

    /// RFC 3207: after the handshake the client starts over with EHLO.
    pub fn tls_started(&mut self, tls_version: Option<String>) {
        self.is_tls_active = true;
        self.tls_version = tls_version;
        self.helo_name = None;
        self.auth_user = None;
        self.auth_mechanism = None;
        self.reset_transaction();
        self.transcript.record_note("TLS started");
    }

    pub(super) fn reset_transaction(&mut self) {
        self.mail_from = None;
        self.recipients.clear();
    }

    pub(super) fn reply(&mut self, code: u16, text: &str) -> SmtpReply {
        let reply = SmtpReply::new(code, text);
        self.transcript.record_server_reply(&reply.to_wire());
        reply
    }

    fn multiline_reply(&mut self, code: u16, lines: Vec<String>) -> SmtpReply {
        let reply = SmtpReply::multiline(code, lines);
        self.transcript.record_server_reply(&reply.to_wire());
        reply
    }

    /// A refusal the session log shows as the reason, unless a message was stored after all.
    pub(super) fn reject(&mut self, code: u16, text: &str) -> SmtpReply {
        self.failure_reason = Some(format!("{code} {text}"));
        self.reply(code, text)
    }
}
