//! The values every webhook template reads: `event`, `data`, and `email` or `sms` as another
//! name for `data` ([12](docs/plan/12-webhook-variables.md#built-in-dynamic-context)).

use sendmock_store::EmailListFilter;
use serde_json::{Map, Value, json};

use crate::email::EmailSummary;
use crate::events::AppEvent;
use crate::{OperationContext, OperationError};

/// `event`, `data`, and `email` or `sms` when the event is about one.
pub fn build_event_template_context(app_event: &AppEvent) -> Map<String, Value> {
    let mut template_context = Map::new();
    template_context.insert(
        "event".to_owned(),
        json!({
            "id": app_event.id,
            "type": app_event.event_type,
            "created_at": app_event.created_at,
        }),
    );
    template_context.insert("data".to_owned(), app_event.data.clone());
    let subject_alias = app_event
        .event_type
        .split('.')
        .next()
        .filter(|event_area| matches!(*event_area, "email" | "sms"));
    if let Some(subject_alias) = subject_alias {
        template_context.insert(subject_alias.to_owned(), app_event.data.clone());
    }
    template_context
}

/// The email a preview uses when none is stored yet.
fn build_sample_email_data() -> Value {
    json!({
        "id": "01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
        "received_at": "2026-01-01T09:00:00Z",
        "from": { "name": "Acme", "address": "no-reply@acme.test" },
        "to": [{ "name": "Ann Lee", "address": "ann@example.com" }],
        "subject": "Your Acme sign-in code",
        "snippet": "Your code is 482913. It expires in 10 minutes.",
        "size_bytes": 2048,
        "attachment_count": 0,
        "is_read": false,
        "tags": [],
        "source": "smtp",
        "delivery_status": null,
        "open_count": 0,
        "has_otp": true,
        "direction": "inbound",
        "response_kind": null,
    })
}

/// The latest email as an `email.received` event, or a built-in sample when there is none,
/// for previews ("Resolves to", the request preview).
pub async fn build_sample_template_context(
    operation_context: &OperationContext,
) -> Result<Map<String, Value>, OperationError> {
    let email_page = operation_context
        .email_repository
        .list_emails(EmailListFilter::default(), None, 1)
        .await?;
    let sample_event = match email_page.emails.first() {
        Some(latest_email) => AppEvent {
            id: format!("evt_{}", latest_email.email_id),
            event_type: "email.received".to_owned(),
            created_at: sendmock_core::format_rfc3339(latest_email.received_at_unix_ms),
            data: serde_json::to_value(EmailSummary::from(latest_email)).unwrap_or_default(),
        },
        None => AppEvent {
            id: "evt_sample".to_owned(),
            event_type: "email.received".to_owned(),
            created_at: "2026-01-01T09:00:00Z".to_owned(),
            data: build_sample_email_data(),
        },
    };
    Ok(build_event_template_context(&sample_event))
}
