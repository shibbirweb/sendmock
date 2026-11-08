use std::sync::Arc;
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

use super::pop3_server::Pop3Server;
use crate::protocol::Pop3Session;

/// RFC 1939 lets a server close a session idle this long.
const IDLE_TIMEOUT: Duration = Duration::from_secs(600);
/// Longer than any command (RFC 2449 allows 255 octets), so a longer line is refused.
const MAX_LINE_BYTES: u64 = 512;

/// One client: the greeting, then a reply per line until QUIT, a refusal that closes, an idle
/// timeout or a dropped connection. Marked messages are only deleted on QUIT.
pub async fn handle_connection(tcp_stream: TcpStream, pop3_server: Arc<Pop3Server>) {
    let (read_half, mut write_half) = tcp_stream.into_split();
    let mut line_reader = BufReader::new(read_half);
    let mut session = Pop3Session::new(&pop3_server.mailbox, &pop3_server.login);
    if write_half
        .write_all(Pop3Session::<super::OperationsMailbox>::greeting().as_bytes())
        .await
        .is_err()
    {
        return;
    }
    loop {
        let mut line_bytes = Vec::new();
        let read_result = tokio::time::timeout(
            IDLE_TIMEOUT,
            (&mut line_reader)
                .take(MAX_LINE_BYTES)
                .read_until(b'\n', &mut line_bytes),
        )
        .await;
        let reply = match read_result {
            Ok(Ok(0)) | Ok(Err(_)) | Err(_) => return,
            Ok(Ok(_)) if !line_bytes.ends_with(b"\n") => {
                if skip_rest_of_line(&mut line_reader).await.is_err() {
                    return;
                }
                "-ERR line too long\r\n".to_owned()
            }
            Ok(Ok(_)) => {
                let command_line = String::from_utf8_lossy(&line_bytes);
                let session_step = session.handle_line(command_line.trim_end()).await;
                if session_step.should_close {
                    let _ = write_half.write_all(session_step.reply.as_bytes()).await;
                    return;
                }
                session_step.reply
            }
        };
        if write_half.write_all(reply.as_bytes()).await.is_err() {
            return;
        }
    }
}

/// Reads past the end of an over-long line, so the next command starts clean.
async fn skip_rest_of_line(
    line_reader: &mut BufReader<tokio::net::tcp::OwnedReadHalf>,
) -> std::io::Result<()> {
    let mut skipped_bytes = Vec::new();
    match line_reader.read_until(b'\n', &mut skipped_bytes).await? {
        0 => Err(std::io::ErrorKind::UnexpectedEof.into()),
        _ => Ok(()),
    }
}
