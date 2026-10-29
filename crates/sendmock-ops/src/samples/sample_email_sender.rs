use std::future::Future;
use std::pin::Pin;

/// A message to send to SendMock's own SMTP listener.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SampleEmail {
    pub mail_from: String,
    pub recipient: String,
    pub raw_message: Vec<u8>,
}

/// Sends a sample over SMTP, so it takes the same path as real traffic and its session is
/// logged; answers the stored email's id. The SMTP crate provides the real one.
pub trait SampleEmailSender: Send + Sync {
    fn send_sample_email<'sender>(
        &'sender self,
        sample_email: SampleEmail,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + 'sender>>;
}
