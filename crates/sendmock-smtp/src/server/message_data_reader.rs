use std::time::Duration;

use tokio::io::{AsyncBufRead, AsyncBufReadExt};

/// How long a client may stay silent before the server hangs up.
pub const IDLE_TIMEOUT: Duration = Duration::from_secs(300);

/// What reading the DATA section gave.
#[derive(Debug, PartialEq, Eq)]
pub enum MessageData {
    Complete(Vec<u8>),
    /// Over the size limit; read to its end and discarded.
    TooLarge(usize),
    Disconnected,
}

/// Reads lines up to the lone `.` line, undoing dot-stuffing, and stops keeping bytes once
/// the message passes `max_size_bytes`.
pub async fn read_message_data<Reader: AsyncBufRead + Unpin>(
    reader: &mut Reader,
    max_size_bytes: u64,
) -> MessageData {
    let max_size_bytes = usize::try_from(max_size_bytes).unwrap_or(usize::MAX);
    let mut message_bytes: Vec<u8> = Vec::new();
    let mut received_bytes = 0_usize;
    let mut line = Vec::new();
    loop {
        line.clear();
        match tokio::time::timeout(IDLE_TIMEOUT, reader.read_until(b'\n', &mut line)).await {
            Ok(Ok(0)) | Ok(Err(_)) | Err(_) => return MessageData::Disconnected,
            Ok(Ok(_)) => {}
        }
        if line == b".\r\n" || line == b".\n" {
            break;
        }
        let unstuffed_line = if line.starts_with(b"..") {
            &line[1..]
        } else {
            &line[..]
        };
        received_bytes += unstuffed_line.len();
        if received_bytes <= max_size_bytes {
            message_bytes.extend_from_slice(unstuffed_line);
        }
    }
    if received_bytes > max_size_bytes {
        return MessageData::TooLarge(received_bytes);
    }
    MessageData::Complete(message_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn reads_to_the_lone_dot_and_undoes_dot_stuffing() {
        let mut reader: &[u8] = b"Subject: Hi\r\n\r\n..leading dot\r\nbody\r\n.\r\nQUIT\r\n";

        let message_data = read_message_data(&mut reader, 1024).await;

        assert_eq!(
            message_data,
            MessageData::Complete(b"Subject: Hi\r\n\r\n.leading dot\r\nbody\r\n".to_vec())
        );
    }

    // AC: EM-01.3
    #[tokio::test]
    async fn reports_a_message_over_the_limit_after_reading_it_all() {
        let mut reader: &[u8] = b"0123456789\r\n0123456789\r\n.\r\n";

        assert_eq!(
            read_message_data(&mut reader, 10).await,
            MessageData::TooLarge(24)
        );
    }

    #[tokio::test]
    async fn notices_a_client_that_disconnects_mid_message() {
        let mut reader: &[u8] = b"Subject: Hi\r\n";

        assert_eq!(
            read_message_data(&mut reader, 1024).await,
            MessageData::Disconnected
        );
    }
}
