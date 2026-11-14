use std::future::Future;
use std::pin::Pin;

/// One message to hand to the relay SMTP server.
#[derive(Debug, Clone, Copy)]
pub struct RelayMessage<'message> {
    /// `smtp://` or `smtps://`, with `user:password@` when the relay needs a login.
    pub relay_url: &'message str,
    pub mail_from: &'message str,
    pub recipients: &'message [String],
    pub raw_message: &'message [u8],
}

/// Sends a message on through a real SMTP server; answers the server's last reply, or why the
/// message was not accepted.
pub trait EmailRelay: Send + Sync {
    fn relay_message<'relay>(
        &'relay self,
        relay_message: RelayMessage<'relay>,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + 'relay>>;
}
