use sendmock_store::{EmailRecord, SmsRecord};
use sendmock_webhooks::RuleMessage;

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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn html_bodies_are_read_as_text() {
        assert_eq!(
            strip_html_tags("<p>Your code is <b>482913</b></p>\n<br>"),
            "Your code is 482913"
        );
    }
}
