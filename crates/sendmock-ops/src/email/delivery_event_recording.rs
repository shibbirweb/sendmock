use sendmock_mail::EmailDeliveryEvent;
use sendmock_store::TimelineRecord;
use serde_json::{Value, json};

use super::email_summary::EmailSummary;
use crate::{AppEventType, OperationContext, OperationError, publish_event};

fn event_type_for(delivery_event: &EmailDeliveryEvent) -> AppEventType {
    match delivery_event {
        EmailDeliveryEvent::Delivered => AppEventType::EmailDelivered,
        EmailDeliveryEvent::Deferred => AppEventType::EmailDeferred,
        EmailDeliveryEvent::Bounced { .. } => AppEventType::EmailBounced,
        EmailDeliveryEvent::Complained => AppEventType::EmailComplained,
        EmailDeliveryEvent::Unsubscribed => AppEventType::EmailUnsubscribed,
    }
}

/// The email as the list shows it, with the recipient the report is about and, for a bounce,
/// its type, SMTP code and reason.
fn build_event_data(
    email_summary: EmailSummary,
    delivery_event: &EmailDeliveryEvent,
    recipient_address: &str,
) -> Value {
    let mut event_data = serde_json::to_value(email_summary).unwrap_or_default();
    let (bounce_type, smtp_code, diagnostic) = match delivery_event {
        EmailDeliveryEvent::Bounced {
            bounce_type,
            smtp_code,
            diagnostic,
        } => (
            Some(bounce_type.as_str()),
            Some(smtp_code.as_str()),
            Some(diagnostic.as_str()),
        ),
        _ => (None, None, None),
    };
    if let Some(data_fields) = event_data.as_object_mut() {
        data_fields.extend([
            ("recipient".to_owned(), json!(recipient_address)),
            ("bounce_type".to_owned(), json!(bounce_type)),
            ("smtp_code".to_owned(), json!(smtp_code)),
            ("diagnostic".to_owned(), json!(diagnostic)),
        ]);
    }
    event_data
}

/// Sets the email's delivery status, adds the report to its timeline and publishes
/// `email.<status>`, which webhook rules pick up; false when the email is gone.
pub async fn record_delivery_event(
    operation_context: &OperationContext,
    email_id: &str,
    delivery_event: &EmailDeliveryEvent,
    recipient_address: &str,
    timeline_detail: String,
) -> Result<bool, OperationError> {
    let timeline_entry = TimelineRecord {
        kind: delivery_event.delivery_status().to_owned(),
        happened_at_unix_ms: operation_context.clock.now_unix_ms(),
        detail: timeline_detail,
    };
    let was_recorded = operation_context
        .email_repository
        .record_delivery_event(email_id, timeline_entry)
        .await?;
    let Some(stored_email) = operation_context
        .email_repository
        .find_email(email_id)
        .await?
        .filter(|_| was_recorded)
    else {
        return Ok(false);
    };
    publish_event(
        operation_context,
        event_type_for(delivery_event),
        build_event_data(
            EmailSummary::from(&stored_email),
            delivery_event,
            recipient_address,
        ),
    );
    Ok(true)
}
