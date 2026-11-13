use sendmock_webhooks::RuleMessage;
use serde_json::Value;

use super::rule_messages::{
    build_email_rule_message, build_push_rule_message, build_sms_rule_message,
};
use crate::{AppEvent, OperationContext, OperationError};

/// Events that drive a live view only: `webhook.delivered` (a rule on it would loop),
/// `sms.reply_webhook` (the result already went with `sms.inbound`'s message) and
/// `traffic.pruned` (housekeeping, about no message).
const UNRULED_EVENT_TYPES: [&str; 3] = ["webhook.delivered", "sms.reply_webhook", "traffic.pruned"];

/// What an event is about, which decides where its filter fields come from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EventSubjectKind {
    Email,
    Sms,
    Push,
    /// A payment or checkout event; payments have no filter fields yet.
    Payment,
    /// Verification and other events, about no stored message.
    Other,
}

fn read_subject_kind(event_type: &str) -> EventSubjectKind {
    if event_type.starts_with("email.") {
        EventSubjectKind::Email
    } else if event_type.starts_with("sms.") {
        EventSubjectKind::Sms
    } else if event_type.starts_with("push.") {
        EventSubjectKind::Push
    } else if event_type.starts_with("payment.") || event_type.starts_with("checkout.") {
        EventSubjectKind::Payment
    } else {
        EventSubjectKind::Other
    }
}

/// Whether rules (or a chosen endpoint) can receive the event at all.
pub fn is_ruled_event(event_type: &str) -> bool {
    !UNRULED_EVENT_TYPES.contains(&event_type)
}

/// The email, SMS, push notification or payment the event is about, by its `data.id`.
pub fn read_event_subject_id(app_event: &AppEvent) -> Option<String> {
    let subject_id = app_event.data["id"].as_str()?;
    match read_subject_kind(&app_event.event_type) {
        EventSubjectKind::Other => None,
        _ => Some(subject_id.to_owned()),
    }
}

/// The fields filters read from the subject; a message that is gone has none, so only
/// filterless rules fire.
pub async fn load_subject_rule_message(
    operation_context: &OperationContext,
    event_type: &str,
    subject_id: &str,
) -> Result<RuleMessage, OperationError> {
    let rule_message = match read_subject_kind(event_type) {
        EventSubjectKind::Email => operation_context
            .email_repository
            .find_email(subject_id)
            .await?
            .as_ref()
            .map(build_email_rule_message),
        EventSubjectKind::Sms => operation_context
            .sms_repository
            .find_message(subject_id)
            .await?
            .as_ref()
            .map(build_sms_rule_message),
        EventSubjectKind::Push => operation_context
            .push_notifications
            .find_notification(subject_id)
            .await?
            .as_ref()
            .map(build_push_rule_message),
        EventSubjectKind::Payment | EventSubjectKind::Other => None,
    };
    Ok(rule_message.unwrap_or_default())
}

/// A verification event has no stored message to read, but its data names its project.
pub fn read_event_project(event_data: &Value) -> RuleMessage {
    match event_data["project"].as_str() {
        Some(project_key) => {
            RuleMessage::default().with_field("project", vec![project_key.to_owned()])
        }
        None => RuleMessage::default(),
    }
}

/// The fields a rule filter reads for an event, as dispatch reads them.
pub async fn load_event_rule_message(
    operation_context: &OperationContext,
    app_event: &AppEvent,
) -> Result<RuleMessage, OperationError> {
    match read_event_subject_id(app_event) {
        Some(subject_id) => {
            load_subject_rule_message(operation_context, &app_event.event_type, &subject_id).await
        }
        None => Ok(read_event_project(&app_event.data)),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn event_about(event_type: &str) -> AppEvent {
        AppEvent {
            id: "evt_01".to_owned(),
            event_type: event_type.to_owned(),
            created_at: "2026-11-13T10:00:00Z".to_owned(),
            data: json!({ "id": "01A", "project": "shop" }),
        }
    }

    #[test]
    fn messages_and_payments_are_the_subject_of_their_events() {
        for event_type in [
            "email.bounced",
            "sms.status",
            "push.sent",
            "payment.succeeded",
        ] {
            assert_eq!(
                read_event_subject_id(&event_about(event_type)),
                Some("01A".to_owned()),
                "{event_type}"
            );
        }
    }

    #[test]
    fn verification_events_have_no_subject_but_name_their_project() {
        let verify_event = event_about("verify.started");

        assert_eq!(read_event_subject_id(&verify_event), None);
        assert_eq!(
            read_event_project(&verify_event.data).read_field("project"),
            Some(vec!["shop".to_owned()])
        );
    }

    #[test]
    fn live_view_events_are_never_ruled() {
        assert!(!is_ruled_event("webhook.delivered"));
        assert!(!is_ruled_event("traffic.pruned"));
        assert!(is_ruled_event("email.received"));
    }
}
