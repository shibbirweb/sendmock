use sendmock_core::format_rfc5322;
use sendmock_mail::{EmailEnvelope, IncomingEmail, NativeMessage, build_raw_message};
use sendmock_store::{EmailRecord, TimelineRecord};

use super::email_summary::EmailSummary;
use crate::{AppEventType, OperationContext, OperationError, publish_event, read_ingest_options};

const OUT_OF_OFFICE_TEXT: &str = "I am out of the office and will reply when I am back.\n";

fn build_reply_message(original_email: &EmailRecord, replying_address: &str) -> NativeMessage {
    let reply_headers = original_email
        .message_id
        .iter()
        .flat_map(|original_message_id| {
            let bracketed_id = format!("<{}>", original_message_id.trim_matches(['<', '>']));
            [
                ("In-Reply-To".to_owned(), bracketed_id.clone()),
                ("References".to_owned(), bracketed_id),
                ("Auto-Submitted".to_owned(), "auto-replied".to_owned()),
            ]
        })
        .collect();
    NativeMessage {
        from: replying_address.to_owned(),
        to: vec![original_email.from.address.clone()],
        cc: Vec::new(),
        subject: format!("Out of office: {}", original_email.subject),
        text: Some(OUT_OF_OFFICE_TEXT.to_owned()),
        html: None,
        headers: reply_headers,
        attachments: Vec::new(),
    }
}

/// Stores the recipient's automatic reply as a new incoming email, notes it on the original's
/// timeline and publishes `email.inbound` (never `email.received`, so rules on sent mail do
/// not loop on it).
pub async fn send_out_of_office_reply(
    operation_context: &OperationContext,
    original_email: &EmailRecord,
    replying_address: &str,
) -> Result<(), OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let message_id = format!(
        "{}@sendmock.local",
        operation_context.id_generator.generate_id()
    );
    let raw_message = build_raw_message(
        &build_reply_message(original_email, replying_address),
        &message_id,
        &format_rfc5322(now_unix_ms),
    );
    let mut incoming_reply = IncomingEmail::sent_by_app(
        raw_message,
        EmailEnvelope {
            mail_from: replying_address.to_owned(),
            recipients: vec![original_email.from.address.clone()],
        },
        "simulated",
    );
    incoming_reply.direction = "inbound".to_owned();
    let stored_reply = operation_context
        .email_ingest_service
        .ingest(
            incoming_reply,
            &read_ingest_options(operation_context).await?,
        )
        .await
        .map_err(|mail_error| OperationError::Internal(mail_error.to_string()))?;
    operation_context
        .email_repository
        .add_timeline_entry(
            &original_email.email_id,
            TimelineRecord {
                kind: "replied".to_owned(),
                happened_at_unix_ms: now_unix_ms,
                detail: format!("Out-of-office reply from {replying_address}"),
            },
        )
        .await?;
    publish_event(
        operation_context,
        AppEventType::EmailInbound,
        serde_json::to_value(EmailSummary::from(&stored_reply)).unwrap_or_default(),
    );
    Ok(())
}
