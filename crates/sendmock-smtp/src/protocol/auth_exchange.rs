use super::smtp_auth::{decode_base64_text, decode_plain_response, encode_base64_text};
use super::smtp_reply::SmtpReply;
use super::smtp_session::SmtpSession;

/// An AUTH exchange waiting for the client's next line.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PendingAuth {
    PlainCredentials,
    LoginUsername,
    LoginPassword { username: String },
    CramMd5 { challenge: String },
}

impl SmtpSession {
    pub(super) fn start_auth(
        &mut self,
        mechanism: &str,
        initial_response: Option<String>,
    ) -> SmtpReply {
        if !self.settings.auth_mode.is_offered() {
            return self.reply(502, "AUTH is not offered");
        }
        if self.auth_user.is_some() {
            return self.reply(503, "Already authenticated");
        }
        match (mechanism, initial_response) {
            ("PLAIN", Some(encoded_credentials)) => self.finish_plain(&encoded_credentials),
            ("PLAIN", None) => self.ask(PendingAuth::PlainCredentials, ""),
            ("LOGIN", Some(encoded_username)) => self.receive_login_username(&encoded_username),
            ("LOGIN", None) => self.ask(PendingAuth::LoginUsername, "Username:"),
            ("CRAM-MD5", _) => {
                let challenge = format!(
                    "<{}.sendmock@{}>",
                    self.transcript.to_text().len(),
                    self.settings.hostname
                );
                let encoded_challenge = encode_base64_text(&challenge);
                self.pending_auth = Some(PendingAuth::CramMd5 { challenge });
                self.reply(334, &encoded_challenge)
            }
            _ => self.reply(
                504,
                "Unrecognised AUTH mechanism; use PLAIN, LOGIN or CRAM-MD5",
            ),
        }
    }

    pub(super) fn continue_auth(
        &mut self,
        pending_auth: PendingAuth,
        client_line: &str,
    ) -> SmtpReply {
        self.transcript.record_masked_client_line();
        if client_line.trim() == "*" {
            return self.reply(501, "AUTH cancelled");
        }
        match pending_auth {
            PendingAuth::PlainCredentials => self.finish_plain(client_line),
            PendingAuth::LoginUsername => self.receive_login_username(client_line),
            PendingAuth::LoginPassword { username } => match decode_base64_text(client_line) {
                Some(password) => self.finish_auth("LOGIN", &username, |auth_mode| {
                    auth_mode.accepts_password(&username, &password)
                }),
                None => self.reply(501, "The password is not valid base64"),
            },
            PendingAuth::CramMd5 { challenge } => {
                let decoded_response = decode_base64_text(client_line).unwrap_or_default();
                let (username, digest_hex) = decoded_response
                    .split_once(' ')
                    .unwrap_or((decoded_response.as_str(), ""));
                let (username, digest_hex) = (username.to_owned(), digest_hex.to_owned());
                self.finish_auth("CRAM-MD5", &username, |auth_mode| {
                    auth_mode.accepts_cram_md5(&username, &challenge, &digest_hex)
                })
            }
        }
    }

    fn ask(&mut self, pending_auth: PendingAuth, prompt: &str) -> SmtpReply {
        self.pending_auth = Some(pending_auth);
        self.reply(334, &encode_base64_text(prompt))
    }

    fn receive_login_username(&mut self, encoded_username: &str) -> SmtpReply {
        match decode_base64_text(encoded_username) {
            Some(username) => self.ask(PendingAuth::LoginPassword { username }, "Password:"),
            None => self.reply(501, "The username is not valid base64"),
        }
    }

    fn finish_plain(&mut self, encoded_credentials: &str) -> SmtpReply {
        match decode_plain_response(encoded_credentials) {
            Some((username, password)) => self.finish_auth("PLAIN", &username, |auth_mode| {
                auth_mode.accepts_password(&username, &password)
            }),
            None => self.reply(501, "The credentials are not valid AUTH PLAIN"),
        }
    }

    fn finish_auth(
        &mut self,
        mechanism: &str,
        username: &str,
        is_accepted: impl FnOnce(&super::SmtpAuthMode) -> bool,
    ) -> SmtpReply {
        if !is_accepted(&self.settings.auth_mode) {
            return self.reject(535, "Authentication credentials invalid");
        }
        self.auth_user = Some(username.to_owned());
        self.auth_mechanism = Some(mechanism.to_owned());
        self.reply(235, "Authentication successful")
    }
}
