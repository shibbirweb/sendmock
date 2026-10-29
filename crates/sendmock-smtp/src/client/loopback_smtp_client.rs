use std::future::Future;
use std::net::SocketAddr;
use std::pin::Pin;
use std::time::Duration;

use sendmock_ops::{SampleEmail, SampleEmailSender};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

/// A sample that takes longer than this is reported as failed.
const LOOPBACK_TIMEOUT: Duration = Duration::from_secs(10);
/// What SendMock's own 250 reply after DATA puts before the stored email's id.
const QUEUED_AS_MARKER: &str = "queued as ";

/// Sends samples to SendMock's own SMTP listener, as an app would.
pub struct LoopbackSmtpClient {
    smtp_addr: SocketAddr,
}

impl LoopbackSmtpClient {
    pub fn new(smtp_addr: SocketAddr) -> Self {
        Self { smtp_addr }
    }
}

impl SampleEmailSender for LoopbackSmtpClient {
    fn send_sample_email<'sender>(
        &'sender self,
        sample_email: SampleEmail,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + 'sender>> {
        Box::pin(async move {
            tokio::time::timeout(
                LOOPBACK_TIMEOUT,
                send_over_smtp(self.smtp_addr, sample_email),
            )
            .await
            .map_err(|_| "the SMTP listener did not answer in time".to_owned())?
        })
    }
}

async fn send_over_smtp(
    smtp_addr: SocketAddr,
    sample_email: SampleEmail,
) -> Result<String, String> {
    let tcp_stream = TcpStream::connect(smtp_addr)
        .await
        .map_err(|connect_error| connect_error.to_string())?;
    let mut connection = BufReader::new(tcp_stream);
    expect_reply(&mut connection, None, 220).await?;
    expect_reply(&mut connection, Some("EHLO sendmock.local"), 250).await?;
    expect_reply(
        &mut connection,
        Some(&format!("MAIL FROM:<{}>", sample_email.mail_from)),
        250,
    )
    .await?;
    expect_reply(
        &mut connection,
        Some(&format!("RCPT TO:<{}>", sample_email.recipient)),
        250,
    )
    .await?;
    expect_reply(&mut connection, Some("DATA"), 354).await?;
    let message_text = String::from_utf8_lossy(&sample_email.raw_message);
    let final_reply = expect_reply(
        &mut connection,
        Some(&format!("{}\r\n.", dot_stuff(&message_text))),
        250,
    )
    .await?;
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

/// Lines starting with a dot get a second one, so the message cannot end DATA early.
fn dot_stuff(message_text: &str) -> String {
    message_text
        .split("\r\n")
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
            dot_stuff("Hello\r\n.hidden\r\n..two"),
            "Hello\r\n..hidden\r\n...two"
        );
    }
}
