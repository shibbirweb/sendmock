/// The SMTP envelope, or the sender and recipients an API call named.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EmailEnvelope {
    pub mail_from: String,
    pub recipients: Vec<String>,
}

/// A message as it arrives, before parsing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IncomingEmail {
    pub raw_message: Vec<u8>,
    pub envelope: EmailEnvelope,
    /// `smtp`, `sendmail`, `native_api`, or an email provider's key.
    pub source: String,
    /// `outbound` for mail your app sent, `inbound` for mail coming in to it.
    pub direction: String,
    pub smtp_session_id: Option<String>,
    pub smtp_auth_user: Option<String>,
    /// Tags the sender asked for, such as the native API's `tags`.
    pub extra_tags: Vec<String>,
}

impl IncomingEmail {
    /// Mail your app sent through `source`, with no SMTP session.
    pub fn sent_by_app(raw_message: Vec<u8>, envelope: EmailEnvelope, source: &str) -> Self {
        Self {
            raw_message,
            envelope,
            source: source.to_owned(),
            direction: "outbound".to_owned(),
            smtp_session_id: None,
            smtp_auth_user: None,
            extra_tags: Vec::new(),
        }
    }
}
