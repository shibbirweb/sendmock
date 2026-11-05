use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use sendmock_mail::{SpamdReport, build_spamd_report_request, parse_spamd_reply};
use sendmock_ops::{OperationContext, SpamChecker};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

/// spamd can run network tests (DNS blocklists) before it answers.
const SPAMD_TIMEOUT: Duration = Duration::from_secs(30);
/// A report is a few kilobytes; anything near this is not spamd.
const MAXIMUM_REPLY_BYTES: u64 = 1024 * 1024;

/// Talks to SpamAssassin's `spamd` over TCP, one connection per check, as `spamc` does.
pub struct SpamdClient;

/// The context with the spamd client; the address comes from the settings on each check.
pub fn with_spamd_client(operation_context: OperationContext) -> OperationContext {
    operation_context.with_spam_checker(Arc::new(SpamdClient))
}

async fn exchange_with_spamd(
    spamd_address: &str,
    raw_message: &[u8],
) -> Result<Vec<u8>, std::io::Error> {
    let mut spamd_stream = TcpStream::connect(spamd_address).await?;
    spamd_stream
        .write_all(&build_spamd_report_request(raw_message))
        .await?;
    spamd_stream.shutdown().await?;
    let mut reply = Vec::new();
    spamd_stream
        .take(MAXIMUM_REPLY_BYTES)
        .read_to_end(&mut reply)
        .await?;
    Ok(reply)
}

impl SpamChecker for SpamdClient {
    fn request_spam_report<'checker>(
        &'checker self,
        spamd_address: &'checker str,
        raw_message: &'checker [u8],
    ) -> Pin<Box<dyn Future<Output = Result<SpamdReport, String>> + Send + 'checker>> {
        Box::pin(async move {
            let reply = tokio::time::timeout(
                SPAMD_TIMEOUT,
                exchange_with_spamd(spamd_address, raw_message),
            )
            .await
            .map_err(|_| "timed out".to_owned())?
            .map_err(|io_error| io_error.to_string())?;
            parse_spamd_reply(&reply).map_err(|reply_error| reply_error.to_string())
        })
    }
}

#[cfg(test)]
mod tests {
    use tokio::net::TcpListener;

    use super::*;

    const FAKE_SPAMD_REPLY: &[u8] = b"SPAMD/1.1 0 EX_OK\r\nSpam: True ; 6.1 / 5.0\r\n\r\nContent analysis details:   (6.1 points, 5.0 required)\n\n pts rule name              description\n---- ---------------------- ---------------------------\n 6.1 SENDMOCK_TEST          A rule the fake spamd hits\n";

    /// A local spamd stand-in: reads the request to the end and answers once.
    async fn start_fake_spamd() -> std::io::Result<(String, tokio::task::JoinHandle<Vec<u8>>)> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let spamd_address = listener.local_addr()?.to_string();
        let fake_spamd = tokio::spawn(async move {
            let mut received_request = Vec::new();
            if let Ok((mut connection, _)) = listener.accept().await {
                let _ = connection.read_to_end(&mut received_request).await;
                let _ = connection.write_all(FAKE_SPAMD_REPLY).await;
            }
            received_request
        });
        Ok((spamd_address, fake_spamd))
    }

    // AC: EM-13.3
    #[tokio::test]
    async fn sends_a_report_request_and_reads_spamds_answer() -> std::io::Result<()> {
        let (spamd_address, fake_spamd) = start_fake_spamd().await?;

        let spam_report = SpamdClient
            .request_spam_report(&spamd_address, b"Subject: Hi\r\n\r\nHello")
            .await;

        let received_request = fake_spamd.await.unwrap_or_default();
        assert!(
            received_request.starts_with(b"REPORT SPAMC/1.5\r\n"),
            "{}",
            String::from_utf8_lossy(&received_request)
        );
        assert_eq!(spam_report.as_ref().map(|report| report.score), Ok(6.1));
        assert_eq!(spam_report.map(|report| report.rules.len()), Ok(1));
        Ok(())
    }

    #[tokio::test]
    async fn an_address_where_nothing_listens_is_an_error() -> std::io::Result<()> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let closed_address = listener.local_addr()?.to_string();
        drop(listener);

        let spam_report = SpamdClient
            .request_spam_report(&closed_address, b"Subject: Hi\r\n\r\nHello")
            .await;

        assert!(spam_report.is_err(), "{spam_report:?}");
        Ok(())
    }
}
