use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};

/// One SMTP client session over any stream: commands, replies and the message data.
pub struct SmtpConversation<Stream> {
    connection: BufReader<Stream>,
}

impl<Stream: AsyncRead + AsyncWrite + Unpin> SmtpConversation<Stream> {
    pub fn new(stream: Stream) -> Self {
        Self {
            connection: BufReader::new(stream),
        }
    }

    /// The stream back, to wrap it in TLS after `STARTTLS`.
    pub fn into_stream(self) -> Stream {
        self.connection.into_inner()
    }

    /// Sends `line` (or nothing, for the greeting) and answers the reply, which must have one
    /// of `expected_codes`; any other reply is the error.
    pub async fn exchange(
        &mut self,
        line: Option<&str>,
        expected_codes: &[u16],
    ) -> Result<String, String> {
        if let Some(line) = line {
            self.connection
                .get_mut()
                .write_all(format!("{line}\r\n").as_bytes())
                .await
                .map_err(|write_error| write_error.to_string())?;
        }
        let reply_text = self.read_reply().await?;
        let reply_code: u16 = reply_text
            .get(..3)
            .and_then(|code_text| code_text.parse().ok())
            .unwrap_or_default();
        if expected_codes.contains(&reply_code) {
            Ok(reply_text)
        } else {
            Err(reply_text)
        }
    }

    /// `DATA`, the message with CRLF line endings and leading dots doubled, and the final dot;
    /// answers the server's reply to the message.
    pub async fn send_message_data(&mut self, raw_message: &[u8]) -> Result<String, String> {
        self.exchange(Some("DATA"), &[354]).await?;
        let data_text = prepare_data_text(&String::from_utf8_lossy(raw_message));
        self.exchange(Some(&format!("{data_text}\r\n.")), &[250])
            .await
    }

    /// A reply, joining the lines of a multi-line one.
    async fn read_reply(&mut self) -> Result<String, String> {
        let mut reply_text = String::new();
        loop {
            let mut reply_line = String::new();
            let read_count = self
                .connection
                .read_line(&mut reply_line)
                .await
                .map_err(|read_error| read_error.to_string())?;
            if read_count == 0 {
                return Err("the SMTP server closed the connection".to_owned());
            }
            reply_text.push_str(&reply_line);
            if reply_line.as_bytes().get(3) != Some(&b'-') {
                break;
            }
        }
        Ok(reply_text.trim_end().to_owned())
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
