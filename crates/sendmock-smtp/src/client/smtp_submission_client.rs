use std::future::Future;
use std::net::SocketAddr;
use std::pin::Pin;
use std::time::Duration;

use sendmock_ops::{SampleEmail, SampleEmailSender};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

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
    let mut connection = BufReader::new(tcp_stream);
    expect_reply(&mut connection, None, 220).await?;
    expect_reply(&mut connection, Some("EHLO sendmock.local"), 250).await?;
    expect_reply(
        &mut connection,
        Some(&format!("MAIL FROM:<{mail_from}>")),
        250,
    )
    .await?;
    for recipient in recipients {
        expect_reply(
            &mut connection,
            Some(&format!("RCPT TO:<{recipient}>")),
            250,
        )
        .await?;
    }
    expect_reply(&mut connection, Some("DATA"), 354).await?;
    let data_text = prepare_data_text(&String::from_utf8_lossy(raw_message));
    let final_reply =
        expect_reply(&mut connection, Some(&format!("{data_text}\r\n.")), 250).await?;
    let _ = expect_reply(&mut connection, Some("QUIT"), 221).await;
    final_reply
        .split_once(QUEUED_AS_MARKER)
        .map(|(_, email_id)| email_id.trim().to_owned())
        .ok_or_else(|| format!("the reply named no email: {final_reply}"))
}

/// Sends `line` (or nothing, for the greeting) and answers the reply, which must have `expected_code`.
async fn expect_reply(
    connection: &mut BufReader<TcpStream>,
    line: Option<&str>,
    expected_code: u16,
) -> Result<String, String> {
    if let Some(line) = line {
        connection
            .get_mut()
            .write_all(format!("{line}\r\n").as_bytes())
            .await
            .map_err(|write_error| write_error.to_string())?;
    }
    let mut reply_text = String::new();
    loop {
        let mut reply_line = String::new();
        let read_count = connection
            .read_line(&mut reply_line)
            .await
            .map_err(|read_error| read_error.to_string())?;
        if read_count == 0 {
            return Err("the SMTP listener closed the connection".to_owned());
        }
        reply_text.push_str(&reply_line);
        if reply_line.as_bytes().get(3) != Some(&b'-') {
            break;
        }
    }
    let reply_code: u16 = reply_text
        .get(..3)
        .and_then(|code_text| code_text.parse().ok())
        .unwrap_or_default();
    if reply_code == expected_code {
        Ok(reply_text.trim_end().to_owned())
    } else {
        Err(reply_text.trim_end().to_owned())
    }
}

/// CRLF line endings (apps such as PHP's `mail()` write bare LF), and a second dot on lines
/// that start with one, so the message cannot end DATA early.
fn prepare_data_text(message_text: &str) -> String {
    message_text
        .replace("\r\n", "\n")
        .trim_end_matches('\n')
        .split('\n')
        .map(|message_line| {
            if message_line.starts_with('.') {
                format!(".{message_line}")
            } else {
                message_line.to_owned()
            }
        })
        .collect::<Vec<_>>()
        .join("\r\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn doubles_leading_dots() {
        assert_eq!(
            prepare_data_text("Hello\r\n.hidden\r\n..two"),
            "Hello\r\n..hidden\r\n...two"
        );
    }

    #[test]
    fn turns_bare_line_feeds_into_crlf() {
        assert_eq!(
            prepare_data_text("Subject: Hi\n\nBody\n"),
            "Subject: Hi\r\n\r\nBody"
        );
    }
}
