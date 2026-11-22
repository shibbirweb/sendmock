use sendmock_store::{EmailRecord, MailgunComplaintRecord, TimelineRecord};
use serde_json::json;

use crate::{OperationContext, OperationError};

pub const MAILGUN_PROVIDER_KEY: &str = "mailgun";
/// Mailgun's reason for a send it did not deliver because the address complained before.
pub const SUPPRESS_COMPLAINT_REASON: &str = "suppress-complaint";

/// The Mailgun sending domain an email went out through, if it went through Mailgun.
pub async fn find_mailgun_domain(
    operation_context: &OperationContext,
    email_id: &str,
) -> Result<Option<String>, OperationError> {
    let provider_send = operation_context
        .email_stores
        .sends
        .find_send(email_id)
        .await?;
    Ok(provider_send
        .filter(|provider_send| provider_send.provider_key == MAILGUN_PROVIDER_KEY)
        .and_then(|provider_send| provider_send.sending_domain))
}

/// A complaint about an email sent through Mailgun puts the address on that domain's
/// complaints table, as Mailgun does.
pub async fn record_mailgun_complaint(
    operation_context: &OperationContext,
    email_id: &str,
    recipient_address: &str,
) -> Result<(), OperationError> {
    let Some(domain) = find_mailgun_domain(operation_context, email_id).await? else {
        return Ok(());
    };
    operation_context
        .email_stores
        .mailgun_complaints
        .add_complaint(MailgunComplaintRecord {
            domain,
            address: recipient_address.to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        })
        .await?;
    Ok(())
}

/// A Mailgun send to an address on the domain's complaints table is accepted but not
/// delivered: each such recipient gets a `failed` report with reason `suppress-complaint`.
/// True when every recipient was suppressed, so no delivery outcome plays.
pub async fn suppress_complained_recipients(
    operation_context: &OperationContext,
    stored_email: &EmailRecord,
) -> Result<bool, OperationError> {
    let Some(domain) = find_mailgun_domain(operation_context, &stored_email.email_id).await? else {
        return Ok(false);
    };
    let recipient_addresses: Vec<&str> = stored_email
        .to
        .iter()
        .chain(&stored_email.cc)
        .chain(&stored_email.bcc)
        .map(|recipient| recipient.address.as_str())
        .collect();
    let mut suppressed_count = 0;
    for recipient_address in &recipient_addresses {
        let complaint = operation_context
            .email_stores
            .mailgun_complaints
            .find_complaint(&domain, recipient_address)
            .await?;
        if complaint.is_none() {
            continue;
        }
        suppressed_count += 1;
        operation_context
            .email_repository
            .record_delivery_event(
                &stored_email.email_id,
                TimelineRecord {
                    kind: "failed".to_owned(),
                    happened_at_unix_ms: operation_context.clock.now_unix_ms(),
                    detail: json!({
                        "recipient": recipient_address,
                        "reason": SUPPRESS_COMPLAINT_REASON,
                    })
                    .to_string(),
                },
            )
            .await?;
    }
    Ok(!recipient_addresses.is_empty() && suppressed_count == recipient_addresses.len())
}
