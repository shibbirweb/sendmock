use std::future::Future;
use std::net::SocketAddr;
use std::pin::Pin;
use std::time::Duration;

use sendmock_ops::{SampleEmail, SampleEmailSender};
use tokio::net::TcpStream;

use super::smtp_conversation::SmtpConversation;

/// A submission that takes longer than this is reported as failed.
const SUBMISSION_TIMEOUT: Duration = Duration::from_secs(10);
/// What SendMock's own 250 reply after DATA puts before the stored email's id.
const QUEUED_AS_MARKER: &str = "queued as ";

/// Submits messages to an SMTP listener, as an app would: samples go to SendMock's own
/// listener, and the `sendmail` shim hands its message over the same way.
pub struct SmtpSubmissionClient {
    smtp_addr: SocketAddr,
}

impl SmtpSubmissionClient {
    pub fn new(smtp_addr: SocketAddr) -> Self {
        Self { smtp_addr }
    }

    /// Sends one message to every recipient; answers the stored email's id.
    pub async fn submit_message(
        &self,
        mail_from: &str,
        recipients: &[String],
        raw_message: &[u8],
    ) -> Result<String, String> {
        let submission = send_over_smtp(self.smtp_addr, mail_from, recipients, raw_message);
        tokio::time::timeout(SUBMISSION_TIMEOUT, submission)
            .await
            .map_err(|_| "the SMTP listener did not answer in time".to_owned())?
    }
}

impl SampleEmailSender for SmtpSubmissionClient {
    fn send_sample_email<'sender>(
        &'sender self,
        sample_email: SampleEmail,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + 'sender>> {
        Box::pin(async move {
            self.submit_message(
                &sample_email.mail_from,
                &[sample_email.recipient],
                &sample_email.raw_message,
            )
            .await
        })
    }
}

async fn send_over_smtp(
    smtp_addr: SocketAddr,
    mail_from: &str,
    recipients: &[String],
    raw_message: &[u8],
) -> Result<String, String> {
    let tcp_stream = TcpStream::connect(smtp_addr)
        .await
        .map_err(|connect_error| connect_error.to_string())?;
    let mut conversation = SmtpConversation::new(tcp_stream);
    conversation.exchange(None, &[220]).await?;
    conversation
        .exchange(Some("EHLO sendmock.local"), &[250])
        .await?;
    conversation
        .exchange(Some(&format!("MAIL FROM:<{mail_from}>")), &[250])
        .await?;
    for recipient in recipients {
        conversation
            .exchange(Some(&format!("RCPT TO:<{recipient}>")), &[250])
            .await?;
    }
    let final_reply = conversation.send_message_data(raw_message).await?;
    let _ = conversation.exchange(Some("QUIT"), &[221]).await;
    final_reply
        .split_once(QUEUED_AS_MARKER)
        .map(|(_, email_id)| email_id.trim().to_owned())
        .ok_or_else(|| format!("the reply named no email: {final_reply}"))
}
