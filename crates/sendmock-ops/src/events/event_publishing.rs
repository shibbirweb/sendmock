use sendmock_core::format_rfc3339;
use sendmock_store::EmailRecord;
use serde_json::{Value, json};

use super::app_event::{AppEvent, AppEventType, RecordedEvent};
use crate::OperationContext;
use crate::email::EmailSummary;

/// Builds the envelope (`evt_` id, time from the clock) and publishes it on the bus.
pub fn publish_event(
    operation_context: &OperationContext,
    event_type: AppEventType,
    data: Value,
) -> RecordedEvent {
    let created_at_unix_ms = operation_context.clock.now_unix_ms();
    operation_context.event_bus.publish(RecordedEvent {
        sequence: 0,
        created_at_unix_ms,
        app_event: AppEvent {
            id: format!("evt_{}", operation_context.id_generator.generate_id()),
            event_type: event_type.as_str().to_owned(),
            created_at: format_rfc3339(created_at_unix_ms),
            data,
        },
    })
}

/// `email.received`, carrying the email as the list shows it.
pub fn publish_email_received(operation_context: &OperationContext, stored_email: &EmailRecord) {
    let email_summary = serde_json::to_value(EmailSummary::from(stored_email)).unwrap_or_default();
    publish_event(
        operation_context,
        AppEventType::EmailReceived,
        email_summary,
    );
}

/// `email.deleted`, with the email's id, or none when every email was deleted.
pub fn publish_email_deleted(
    operation_context: &OperationContext,
    email_id: Option<&str>,
    deleted_count: u64,
) {
    publish_event(
        operation_context,
        AppEventType::EmailDeleted,
        json!({ "id": email_id, "deleted_count": deleted_count }),
    );
}
