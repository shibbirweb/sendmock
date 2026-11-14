mod auth_exchange;
mod recipient_policy;
mod session_outcome;
mod session_transcript;
mod smtp_auth;
mod smtp_command;
mod smtp_reply;
mod smtp_session;

#[cfg(test)]
mod smtp_session_tests;

pub use recipient_policy::RecipientPolicy;
pub use session_outcome::MessageEnvelope;
pub use smtp_auth::{SmtpAuthMode, SmtpAuthModeError, cram_md5_digest, encode_base64_text};
pub use smtp_reply::SmtpReply;
pub use smtp_session::{SessionAction, SessionResult, SessionSettings, SmtpSession};
