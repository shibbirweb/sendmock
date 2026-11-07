use std::future::Future;

use sendmock_ops::Pop3MailboxMessage;

/// A mailbox could not be read or changed; the client gets `-ERR`, the log the reason.
#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct Pop3MailboxError(pub String);

/// Where a session's messages come from (Dependency inversion: the session is tested with a
/// fake, the listener uses SendMock's operations).
pub trait Pop3Mailbox: Send + Sync {
    /// The mailbox a login opens, numbered oldest first.
    fn open(
        &self,
        username: &str,
    ) -> impl Future<Output = Result<Vec<Pop3MailboxMessage>, Pop3MailboxError>> + Send;

    /// The message as SendMock received it.
    fn read_message(
        &self,
        email_id: &str,
    ) -> impl Future<Output = Result<Vec<u8>, Pop3MailboxError>> + Send;

    /// Deletes the messages a client marked, when it sends QUIT.
    fn delete_messages(
        &self,
        email_ids: &[String],
    ) -> impl Future<Output = Result<(), Pop3MailboxError>> + Send;
}
