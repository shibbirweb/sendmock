use sendmock_mail::EmailDeliveryEvent;
use sendmock_store::{
    EmailClickRecord, EmailProviderSendRecord, EmailRecord, MessageOpenRecord, TimelineRecord,
};
use serde_json::{Value, json};

use super::mailgun_complaint_recording::SUPPRESS_COMPLAINT_REASON;
use crate::email::{build_bounce_data, read_stored_user_variables};

/// One Mailgun event, with what its filters and its order read.
#[derive(Debug, Clone, PartialEq)]
pub struct MailgunEvent {
    pub happened_at_unix_ms: i64,
    pub event_name: String,
    pub recipient: String,
    pub severity: Option<String>,
    pub item: Value,
}

/// Everything SendMock keeps about one email sent through Mailgun.
pub struct MailgunEmailRecords {
    /// Where the stored-message API reads the email back, as the events' `storage.url`.
    pub message_url: String,
    pub email: EmailRecord,
    pub provider_send: EmailProviderSendRecord,
    pub timeline: Vec<TimelineRecord>,
    pub opens: Vec<MessageOpenRecord>,
    pub clicks: Vec<EmailClickRecord>,
}

/// How a timeline report reads as a Mailgun event: its name, a failure's severity and reason,
/// and Mailgun's delivery status code.
struct ReportShape {
    event_name: &'static str,
    severity: Option<&'static str>,
    reason: Option<&'static str>,
    status_code: Option<u16>,
}

fn shape_report(timeline_kind: &str, detail: &str) -> Option<ReportShape> {
    let shape = |event_name, severity, reason, status_code| ReportShape {
        event_name,
        severity,
        reason,
        status_code,
    };
    match timeline_kind {
        "delivered" => Some(shape("delivered", None, None, Some(250))),
        "bounced" => Some(shape_bounce(detail)),
        "deferred" => Some(shape(
            "failed",
            Some("temporary"),
            Some("generic"),
            Some(421),
        )),
        "complained" => Some(shape("complained", None, None, None)),
        "unsubscribed" => Some(shape("unsubscribed", None, None, None)),
        "failed" if detail.contains(SUPPRESS_COMPLAINT_REASON) => Some(shape(
            "failed",
            Some("permanent"),
            Some(SUPPRESS_COMPLAINT_REASON),
            Some(605),
        )),
        _ => None,
    }
}

/// A soft bounce is Mailgun's temporary failure with its code (452), a hard one permanent.
fn shape_bounce(detail: &str) -> ReportShape {
    let bounce = EmailDeliveryEvent::read_described_bounce(detail);
    let bounce_data = bounce.as_ref().and_then(build_bounce_data);
    let is_temporary = bounce_data
        .as_ref()
        .is_some_and(|bounce_fields| bounce_fields["severity"] == "temporary");
    let status_code = bounce_data
        .as_ref()
        .and_then(|bounce_fields| bounce_fields["code"].as_u64())
        .and_then(|code| u16::try_from(code).ok());
    match is_temporary {
        true => ReportShape {
            event_name: "failed",
            severity: Some("temporary"),
            reason: Some("generic"),
            status_code: status_code.or(Some(452)),
        },
        false => ReportShape {
            event_name: "failed",
            severity: Some("permanent"),
            reason: Some("bounce"),
            status_code: status_code.or(Some(550)),
        },
    }
}

/// The recipient a report names: `"recipient"` in a JSON detail, or the text before `: `.
fn read_report_recipient(detail: &str, fallback_recipient: &str) -> String {
    if let Ok(detail_fields) = serde_json::from_str::<Value>(detail)
        && let Some(recipient) = detail_fields["recipient"].as_str()
    {
        return recipient.to_owned();
    }
    detail
        .split_once(": ")
        .map(|(recipient, _)| recipient.to_owned())
        .filter(|recipient| recipient.contains('@'))
        .unwrap_or_else(|| fallback_recipient.to_owned())
}

/// Builds events one at a time, numbering them in order for their ids.
struct EventBuilder<'records> {
    records: &'records MailgunEmailRecords,
    events: Vec<MailgunEvent>,
}

impl EventBuilder<'_> {
    fn push(
        &mut self,
        event_name: &str,
        recipient: &str,
        happened_at_unix_ms: i64,
    ) -> &mut MailgunEvent {
        let item = describe_event(
            self.records,
            self.events.len(),
            event_name,
            recipient,
            happened_at_unix_ms,
        );
        self.events.push(MailgunEvent {
            happened_at_unix_ms,
            event_name: event_name.to_owned(),
            recipient: recipient.to_owned(),
            severity: None,
            item,
        });
        let last_index = self.events.len() - 1;
        &mut self.events[last_index]
    }
}

/// The events of one email: accepted for each recipient, then each report, open and click, in
/// Mailgun's event shape with the same data the `mailgun.events` template sends.
pub fn build_email_events(records: &MailgunEmailRecords) -> Vec<MailgunEvent> {
    let email = &records.email;
    let first_recipient = email
        .to
        .first()
        .map(|recipient| recipient.address.clone())
        .unwrap_or_default();
    let mut builder = EventBuilder {
        records,
        events: Vec::new(),
    };
    for recipient in email.to.iter().chain(&email.cc).chain(&email.bcc) {
        builder.push("accepted", &recipient.address, email.received_at_unix_ms);
    }
    for timeline_entry in &records.timeline {
        let Some(report_shape) = shape_report(&timeline_entry.kind, &timeline_entry.detail) else {
            continue;
        };
        let recipient = read_report_recipient(&timeline_entry.detail, &first_recipient);
        let event = builder.push(
            report_shape.event_name,
            &recipient,
            timeline_entry.happened_at_unix_ms,
        );
        add_failure_fields(event, &report_shape, &timeline_entry.detail);
    }
    for open in &records.opens {
        builder.push("opened", &first_recipient, open.opened_at_unix_ms);
    }
    for click in &records.clicks {
        let event = builder.push("clicked", &first_recipient, click.clicked_at_unix_ms);
        event.item["url"] = Value::from(click.url.clone());
    }
    builder.events
}

fn add_failure_fields(event: &mut MailgunEvent, report_shape: &ReportShape, detail: &str) {
    event.severity = report_shape.severity.map(str::to_owned);
    if let Some(severity) = report_shape.severity {
        event.item["severity"] = Value::from(severity);
        event.item["log-level"] = Value::from(if severity == "permanent" {
            "error"
        } else {
            "warn"
        });
    }
    if let Some(reason) = report_shape.reason {
        event.item["reason"] = Value::from(reason);
    }
    if let Some(status_code) = report_shape.status_code {
        event.item["delivery-status"] = json!({
            "code": status_code,
            "message": detail,
            "description": detail,
            "attempt-no": 1,
        });
    }
}

fn describe_event(
    records: &MailgunEmailRecords,
    event_index: usize,
    event_name: &str,
    recipient: &str,
    happened_at_unix_ms: i64,
) -> Value {
    let email = &records.email;
    let message_id = records
        .provider_send
        .provider_message_id
        .trim_matches(['<', '>'])
        .to_owned();
    let to_addresses: Vec<&str> = email
        .to
        .iter()
        .map(|recipient| recipient.address.as_str())
        .collect();
    #[allow(
        clippy::cast_precision_loss,
        reason = "Mailgun writes event times as seconds with a fraction; millisecond precision fits"
    )]
    let timestamp_seconds = happened_at_unix_ms as f64 / 1000.0;
    json!({
        "id": format!("{}-{event_index}", email.email_id),
        "event": event_name,
        "timestamp": timestamp_seconds,
        "log-level": "info",
        "recipient": recipient,
        "recipient-domain": recipient.split_once('@').map(|(_, domain)| domain).unwrap_or_default(),
        "tags": email.tags,
        "user-variables": read_stored_user_variables(&records.provider_send),
        "storage": { "url": records.message_url, "key": email.email_id },
        "message": {
            "headers": {
                "message-id": message_id,
                "from": email.from.address,
                "to": to_addresses.join(", "),
                "subject": email.subject,
            },
            "size": email.size_bytes,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_recipient_from_a_text_or_a_json_detail() {
        assert_eq!(
            read_report_recipient("sam@example.test: delivered (simulated)", "x@example.test"),
            "sam@example.test"
        );
        assert_eq!(
            read_report_recipient(
                r#"{"recipient":"ana@example.test","reason":"suppress-complaint"}"#,
                "x@example.test"
            ),
            "ana@example.test"
        );
        assert_eq!(
            read_report_recipient("delivered", "x@example.test"),
            "x@example.test"
        );
    }

    // AC: EM-25.2
    #[test]
    fn a_soft_bounce_is_a_temporary_failure_with_its_code() {
        let soft_bounce = shape_report(
            "bounced",
            "sam@example.test: soft bounce, 452 4.2.2 mailbox full (simulated)",
        );

        assert!(
            soft_bounce.is_some_and(|shape| shape.severity == Some("temporary")
                && shape.reason == Some("generic")
                && shape.status_code == Some(452))
        );
    }

    #[test]
    fn a_bounce_is_a_permanent_failure_and_a_deferral_a_temporary_one() {
        let bounce = shape_report("bounced", "");
        let deferral = shape_report("deferred", "");

        assert!(bounce.is_some_and(
            |shape| shape.event_name == "failed" && shape.severity == Some("permanent")
        ));
        assert!(deferral.is_some_and(|shape| shape.severity == Some("temporary")));
        assert!(shape_report("replied", "").is_none());
    }
}
