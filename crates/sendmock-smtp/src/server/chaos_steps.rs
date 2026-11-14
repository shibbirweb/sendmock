//! Settings > Chaos applied to an SMTP session (EM-15).

use sendmock_ops::{read_smtp_chaos, take_chaos_rejection};

use super::smtp_server::SmtpServer;
use crate::protocol::{SmtpReply, SmtpSession};

/// What chaos does with a message that has fully arrived.
pub enum DataChaos {
    None,
    /// Close the connection without answering (EM-15.3).
    Drop,
    /// Refuse it with "Reject next N"'s code (EM-15.1).
    Reply(SmtpReply),
}

pub async fn apply_data_chaos(
    server: &SmtpServer,
    session: &mut SmtpSession,
    size_bytes: usize,
) -> DataChaos {
    let operation_context = &server.operation_context;
    if read_smtp_chaos(operation_context)
        .await
        .is_ok_and(|smtp_chaos| smtp_chaos.is_drop_during_data_enabled)
    {
        session.note_connection_problem("Dropped during DATA by SendMock chaos");
        return DataChaos::Drop;
    }
    match take_chaos_rejection(operation_context).await {
        Ok(Some(reject_code)) => {
            DataChaos::Reply(session.reject_message_by_chaos(size_bytes, reject_code))
        }
        _ => DataChaos::None,
    }
}

/// `550` for a recipient the chaos pattern refuses (EM-15.2).
pub async fn find_chaos_refusal(server: &SmtpServer, forward_path: &str) -> Option<SmtpReply> {
    let smtp_chaos = read_smtp_chaos(&server.operation_context).await.ok()?;
    let recipient_address = forward_path.trim_matches(['<', '>']);
    smtp_chaos
        .is_rejected_recipient(recipient_address)
        .then(|| SmtpReply::new(550, "5.1.1 Recipient rejected by SendMock chaos"))
}

/// Each reply waits the chaos command latency (EM-15.3).
pub async fn wait_chaos_latency(server: &SmtpServer) {
    if let Ok(smtp_chaos) = read_smtp_chaos(&server.operation_context).await
        && smtp_chaos.command_latency_ms > 0
    {
        tokio::time::sleep(std::time::Duration::from_millis(u64::from(
            smtp_chaos.command_latency_ms,
        )))
        .await;
    }
}
