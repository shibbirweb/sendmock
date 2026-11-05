/// The message a provider request stored, which its request log entry links to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreatedMessage {
    /// `sms` or `email`, as the request log names message kinds.
    pub message_kind: &'static str,
    pub message_id: String,
}

impl CreatedMessage {
    pub fn sms(sms_id: String) -> Self {
        Self {
            message_kind: "sms",
            message_id: sms_id,
        }
    }

    pub fn email(email_id: String) -> Self {
        Self {
            message_kind: "email",
            message_id: email_id,
        }
    }
}
