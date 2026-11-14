/// Every command and reply of a session, in order, with AUTH secrets masked and message
/// content left out (the stored email holds it).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SessionTranscript {
    lines: Vec<String>,
    total_length: usize,
}

/// Transcripts stop growing here, so a client sending junk cannot fill the disk.
const MAXIMUM_TRANSCRIPT_LENGTH: usize = 256 * 1024;
const MASKED_SECRET: &str = "********";

impl SessionTranscript {
    pub fn record_client_line(&mut self, client_line: &str) {
        self.push(format!("C: {client_line}"));
    }

    /// A line answering an AUTH challenge, which holds a username or a password.
    pub fn record_masked_client_line(&mut self) {
        self.push(format!("C: {MASKED_SECRET}"));
    }

    /// `AUTH PLAIN <credentials>` keeps the mechanism and hides the rest.
    pub fn record_auth_command(&mut self, mechanism: &str, has_initial_response: bool) {
        let suffix = if has_initial_response {
            format!(" {MASKED_SECRET}")
        } else {
            String::new()
        };
        self.push(format!("C: AUTH {mechanism}{suffix}"));
    }

    pub fn record_server_reply(&mut self, reply_wire_text: &str) {
        for reply_line in reply_wire_text.lines() {
            self.push(format!("S: {reply_line}"));
        }
    }

    pub fn record_message_content(&mut self, size_bytes: usize, email_id: Option<&str>) {
        let destination = email_id.map_or_else(
            || "not stored".to_owned(),
            |email_id| format!("stored as email {email_id}"),
        );
        self.push(format!("C: [message, {size_bytes} bytes, {destination}]"));
    }

    pub fn record_note(&mut self, note: &str) {
        self.push(format!("-- {note}"));
    }

    pub fn to_text(&self) -> String {
        self.lines.join("\n")
    }

    fn push(&mut self, transcript_line: String) {
        if self.total_length >= MAXIMUM_TRANSCRIPT_LENGTH {
            return;
        }
        self.total_length += transcript_line.len() + 1;
        self.lines.push(transcript_line);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-09.2
    #[test]
    fn masks_auth_secrets_and_links_message_content() {
        let mut transcript = SessionTranscript::default();
        transcript.record_client_line("EHLO app.test");
        transcript.record_server_reply("250-sendmock.local\r\n250 AUTH PLAIN LOGIN\r\n");
        transcript.record_auth_command("PLAIN", true);
        transcript.record_masked_client_line();
        transcript.record_message_content(512, Some("01J0EMAIL"));

        assert_eq!(
            transcript.to_text(),
            "C: EHLO app.test\nS: 250-sendmock.local\nS: 250 AUTH PLAIN LOGIN\nC: AUTH PLAIN ********\nC: ********\nC: [message, 512 bytes, stored as email 01J0EMAIL]"
        );
    }
}
