use sendmock_store::{EmailRecord, SmsRecord};
use sendmock_webhooks::RuleMessage;
use serde_json::Value;

use crate::AppEvent;

/// The fields an opened event carries about the open itself.
const OPEN_EVENT_FIELDS: [&str; 3] = ["first_open", "open_count", "source"];
/// The fields a clicked event carries about the click itself.
const CLICK_EVENT_FIELDS: [&str; 4] = ["url", "first_click", "click_count", "source"];

/// HTML without its tags, for emails that have no text part.
fn strip_html_tags(html_body: &str) -> String {
    let mut text = String::with_capacity(html_body.len());
    let mut is_inside_tag = false;
    for character in html_body.chars() {
        match character {
            '<' => is_inside_tag = true,
            '>' => {
                is_inside_tag = false;
                text.push(' ');
            }
            _ if !is_inside_tag => text.push(character),
            _ => {}
        }
    }
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The fields a filter reads from an email, as the rule builder's preview reads them.
pub fn build_email_rule_message(stored_email: &EmailRecord) -> RuleMessage {
    let body = stored_email
        .text_body
        .clone()
        .unwrap_or_else(|| strip_html_tags(stored_email.html_body.as_deref().unwrap_or_default()));
    RuleMessage::default()
        .with_field("from", vec![stored_email.from.address.clone()])
        .with_field(
            "to",
            stored_email
                .to
                .iter()
                .map(|recipient| recipient.address.clone())
                .collect(),
        )
        .with_field(
            "cc",
            stored_email
                .cc
                .iter()
                .map(|recipient| recipient.address.clone())
                .collect(),
        )
        .with_field("subject", vec![stored_email.subject.clone()])
        .with_field("body", vec![body])
        .with_field(
            "has_attachment",
            vec![(!stored_email.attachments.is_empty()).to_string()],
        )
        .with_field("tag", stored_email.tags.clone())
        .with_field("open_count", vec![stored_email.open_count.to_string()])
        .with_field(
            "first_open",
            vec![(stored_email.open_count == 1).to_string()],
        )
        .with_field("project", vec![stored_email.project_key.clone()])
        .with_headers(stored_email.headers.clone())
}

/// The fields a filter reads from an SMS.
pub fn build_sms_rule_message(stored_sms: &SmsRecord) -> RuleMessage {
    RuleMessage::default()
        .with_field("from", vec![stored_sms.from_number.clone()])
        .with_field("to", vec![stored_sms.to_number.clone()])
        .with_field("body", vec![stored_sms.body.clone()])
        .with_field("status", vec![stored_sms.status.clone()])
        .with_field("api", vec![stored_sms.api.clone()])
        .with_field("open_count", vec![stored_sms.open_count.to_string()])
        .with_field("first_open", vec![(stored_sms.open_count == 1).to_string()])
        .with_field("project", vec![stored_sms.project_key.clone()])
}

/// An opened or clicked event's own fields (`first_open`, `open_count`, `url`, `first_click`,
/// `click_count`, `source`) win over the stored message's: a later open or click may have
/// changed the count, and an email's stored `source` says how it arrived, not who opened it.
pub fn with_engagement_event_fields(
    rule_message: RuleMessage,
    app_event: &AppEvent,
) -> RuleMessage {
    let event_fields: &[&str] = if app_event.event_type.ends_with(".opened") {
        &OPEN_EVENT_FIELDS
    } else if app_event.event_type.ends_with(".clicked") {
        &CLICK_EVENT_FIELDS
    } else {
        return rule_message;
    };
    event_fields
        .iter()
        .copied()
        .fold(rule_message, |open_message, field_key| {
            match &app_event.data[field_key] {
                Value::Null => open_message,
                Value::String(field_text) => {
                    open_message.with_field(field_key, vec![field_text.clone()])
                }
                field_value => open_message.with_field(field_key, vec![field_value.to_string()]),
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn opened_event(event_type: &str) -> AppEvent {
        AppEvent {
            id: "evt_01".to_owned(),
            event_type: event_type.to_owned(),
            created_at: "2026-11-05T10:00:00Z".to_owned(),
            data: json!({ "id": "01A", "first_open": false, "open_count": 3, "source": "manual" }),
        }
    }

    #[test]
    fn opened_events_are_filtered_on_the_open_they_carry() {
        let stored_fields = RuleMessage::default()
            .with_field("open_count", vec!["4".to_owned()])
            .with_field("source", vec!["smtp".to_owned()]);

        let open_message =
            with_engagement_event_fields(stored_fields, &opened_event("email.opened"));

        assert_eq!(
            open_message.read_field("first_open"),
            Some(vec!["false".to_owned()])
        );
        assert_eq!(
            open_message.read_field("open_count"),
            Some(vec!["3".to_owned()])
        );
        assert_eq!(
            open_message.read_field("source"),
            Some(vec!["manual".to_owned()])
        );
    }

    // AC: EM-20.4
    #[test]
    fn clicked_events_are_filtered_on_the_click_they_carry() {
        let clicked_event = AppEvent {
            data: json!({
                "id": "01A",
                "url": "https://app.test/verify",
                "first_click": true,
                "click_count": 2,
                "source": "api",
            }),
            ..opened_event("email.clicked")
        };

        let click_message = with_engagement_event_fields(RuleMessage::default(), &clicked_event);

        assert_eq!(
            click_message.read_field("url"),
            Some(vec!["https://app.test/verify".to_owned()])
        );
        assert_eq!(
            click_message.read_field("first_click"),
            Some(vec!["true".to_owned()])
        );
        assert_eq!(
            click_message.read_field("click_count"),
            Some(vec!["2".to_owned()])
        );
    }

    #[test]
    fn other_events_keep_the_stored_fields() {
        let stored_fields = RuleMessage::default().with_field("source", vec!["smtp".to_owned()]);

        let event_message =
            with_engagement_event_fields(stored_fields.clone(), &opened_event("email.received"));

        assert_eq!(event_message, stored_fields);
    }

    #[test]
    fn html_bodies_are_read_as_text() {
        assert_eq!(
            strip_html_tags("<p>Your code is <b>482913</b></p>\n<br>"),
            "Your code is 482913"
        );
    }
}
