use super::smtp_reply::SmtpReply;
use super::smtp_session::{SessionResult, SmtpSession};

/// The sender and recipients of the message being received.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageEnvelope {
    pub mail_from: String,
    pub recipients: Vec<String>,
}

impl SmtpSession {
    pub fn envelope(&self) -> MessageEnvelope {
        MessageEnvelope {
            mail_from: self.mail_from.clone().unwrap_or_default(),
            recipients: self.recipients.clone(),
        }
    }

    pub fn max_size_bytes(&self) -> u64 {
        self.settings.max_size_bytes
    }

    /// The reply after DATA: 250 with the stored email's id, or 451 when storing failed.
    pub fn complete_message(
        &mut self,
        size_bytes: usize,
        stored_email_id: Result<String, String>,
    ) -> SmtpReply {
        self.reset_transaction();
        match stored_email_id {
            Ok(email_id) => {
                self.transcript
                    .record_message_content(size_bytes, Some(&email_id));
                self.email_ids.push(email_id.clone());
                self.reply(250, &format!("OK: queued as {email_id}"))
            }
            Err(storage_problem) => {
                self.transcript.record_message_content(size_bytes, None);
                self.reject(
                    451,
                    &format!("Could not store the message: {storage_problem}"),
                )
            }
        }
    }

    pub fn reject_oversized_message(&mut self, size_bytes: usize) -> SmtpReply {
        self.reset_transaction();
        self.transcript.record_message_content(size_bytes, None);
        let limit_bytes = self.settings.max_size_bytes;
        self.reject(
            552,
            &format!("Message size exceeds the {limit_bytes} byte limit"),
        )
    }

    /// The client went away, sent garbage the connection could not read, or TLS failed.
    pub fn note_connection_problem(&mut self, problem: &str) {
        self.transcript.record_note(problem);
        self.connection_problem
            .get_or_insert_with(|| problem.to_owned());
    }

    /// Delivered when any message was stored, rejected when the server refused something,
    /// otherwise aborted.
    pub fn result(&self) -> SessionResult {
        match (self.email_ids.is_empty(), &self.failure_reason) {
            (false, _) => SessionResult::Delivered,
            (true, Some(_)) => SessionResult::Rejected,
            (true, None) => SessionResult::Aborted,
        }
    }

    /// The refusal, else the connection problem; none for a session that delivered.
    pub fn failure_reason(&self) -> Option<&str> {
        self.failure_reason
            .as_deref()
            .or(self.connection_problem.as_deref())
            .filter(|_| self.email_ids.is_empty())
    }

    pub fn helo_name(&self) -> &str {
        self.helo_name.as_deref().unwrap_or_default()
    }

    pub fn tls_version(&self) -> Option<&str> {
        self.tls_version.as_deref()
    }

    pub fn auth_user(&self) -> Option<&str> {
        self.auth_user.as_deref()
    }

    pub fn auth_mechanism(&self) -> Option<&str> {
        self.auth_mechanism.as_deref()
    }

    pub fn email_ids(&self) -> &[String] {
        &self.email_ids
    }

    pub fn transcript_text(&self) -> String {
        self.transcript.to_text()
    }
}
