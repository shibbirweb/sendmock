//! The values every webhook template reads: `event`, `data`, and `email` or `sms` as another
//! name for `data` ([12](docs/plan/12-webhook-variables.md#built-in-dynamic-context)).

use sendmock_store::{EmailListFilter, EmailRecord, SmsRecord};
use serde_json::{Map, Value, json};

use crate::email::EmailSummary;
use crate::events::AppEvent;
use crate::{OperationContext, OperationError, SmsMessage};

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

/// The SMS a preview uses when none is chosen.
fn build_sample_sms_data() -> Value {
    json!({
        "id": "01JB7T9Q2R5W8X3Y6Z1A4B7C9E",
        "provider_id": "SM00000000000000000000000000000001",
        "from_number": "+15550001111",
        "to_number": "+14155550100",
        "body": "Your Acme code is 482913",
        "status": "delivered",
        "error_code": null,
        "extracted": { "otp": ["482913"], "links": [] },
    })
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

/// The message a preview renders against; with none, the sample of `sample_event_type`
/// (`email.received` when it is not given).
#[derive(Debug, Clone, Copy, Default)]
pub struct ChosenMessage<'message> {
    pub email_id: Option<&'message str>,
    pub sms_id: Option<&'message str>,
    pub http_request_id: Option<&'message str>,
    pub sample_event_type: Option<&'message str>,
}

/// The event a preview renders against, and what to call it.
pub struct TemplateSubject {
    pub app_event: AppEvent,
    /// "Built-in sample", an email subject or an SMS body.
    pub rendered_against: String,
}

fn to_email_subject(stored_email: &EmailRecord) -> TemplateSubject {
    TemplateSubject {
        app_event: AppEvent {
            id: format!("evt_{}", stored_email.email_id),
            event_type: "email.received".to_owned(),
            created_at: sendmock_core::format_rfc3339(stored_email.received_at_unix_ms),
            data: serde_json::to_value(EmailSummary::from(stored_email)).unwrap_or_default(),
        },
        rendered_against: if stored_email.subject.is_empty() {
            "(no subject)".to_owned()
        } else {
            stored_email.subject.clone()
        },
    }
}

fn to_sms_subject(stored_sms: &SmsRecord) -> TemplateSubject {
    let event_type = if stored_sms.direction == "inbound" {
        "sms.inbound"
    } else {
        "sms.sent"
    };
    TemplateSubject {
        app_event: AppEvent {
            id: format!("evt_{}", stored_sms.sms_id),
            event_type: event_type.to_owned(),
            created_at: sendmock_core::format_rfc3339(stored_sms.created_at_unix_ms),
            data: serde_json::to_value(SmsMessage::from(stored_sms)).unwrap_or_default(),
        },
        rendered_against: stored_sms.body.clone(),
    }
}

fn not_found(message: String) -> OperationError {
    OperationError::NotFound { message }
}

/// The chosen email or SMS; with neither, the latest email, or the built-in sample when no
/// email is stored yet. Captured HTTP requests arrive with the HTTP catcher (Phase 5).
pub async fn find_template_subject(
    operation_context: &OperationContext,
    chosen_message: ChosenMessage<'_>,
) -> Result<TemplateSubject, OperationError> {
    let ChosenMessage {
        email_id,
        sms_id,
        http_request_id,
        sample_event_type,
    } = chosen_message;
    if let Some(email_id) = email_id {
        let stored_email = operation_context
            .email_repository
            .find_email(email_id)
            .await?;
        return stored_email
            .map(|stored_email| to_email_subject(&stored_email))
            .ok_or_else(|| not_found(format!("No email with id {email_id}")));
    }
    if let Some(sms_id) = sms_id {
        let stored_sms = operation_context
            .sms_repository
            .find_message(sms_id)
            .await?;
        return stored_sms
            .map(|stored_sms| to_sms_subject(&stored_sms))
            .ok_or_else(|| not_found(format!("No SMS with id {sms_id}")));
    }
    if let Some(http_request_id) = http_request_id {
        return Err(not_found(format!(
            "No captured HTTP request with id {http_request_id}"
        )));
    }
    let sample_event_type = sample_event_type.unwrap_or("email.received");
    if sample_event_type != "email.received" {
        return Ok(build_sample_subject(sample_event_type));
    }
    let email_page = operation_context
        .email_repository
        .list_emails(EmailListFilter::default(), None, 1)
        .await?;
    Ok(match email_page.emails.first() {
        Some(latest_email) => to_email_subject(latest_email),
        None => build_sample_subject(sample_event_type),
    })
}

/// A fixed example of an event type, for a preview when no message is chosen.
pub fn build_sample_subject(event_type: &str) -> TemplateSubject {
    let sample_data = if event_type.starts_with("sms.") {
        build_sample_sms_data()
    } else if event_type.starts_with("http.") {
        json!({
            "bin": "slack",
            "method": "POST",
            "url": "http://127.0.0.1:8025/catch/slack",
            "path": "/catch/slack",
            "query": {},
            "headers": { "content-type": "application/json" },
            "body": "{\"text\":\"Deploy finished\"}",
            "json": { "text": "Deploy finished" },
        })
    } else if event_type.starts_with("webhook.") {
        json!({ "endpoint_name": "Laravel inbound mail", "error_message": "HTTP 500" })
    } else {
        build_sample_email_data()
    };
    TemplateSubject {
        app_event: AppEvent {
            id: "evt_sample".to_owned(),
            event_type: event_type.to_owned(),
            created_at: "2026-01-01T09:00:00Z".to_owned(),
            data: sample_data,
        },
        rendered_against: "Built-in sample".to_owned(),
    }
}

/// The latest email as an `email.received` event, or a built-in sample when there is none,
/// for previews ("Resolves to", the request preview).
pub async fn build_sample_template_context(
    operation_context: &OperationContext,
) -> Result<Map<String, Value>, OperationError> {
    let sample_subject = find_template_subject(operation_context, ChosenMessage::default()).await?;
    Ok(build_event_template_context(&sample_subject.app_event))
}
