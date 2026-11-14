//! SendMock event types in an email provider's own words, for the built-in provider templates
//! (`email.bounced` is SendGrid's `bounce`, SES's `Bounce` and Resend's `email.bounced`).

/// SendMock's outcome, then SendGrid's, SES's, Resend's, Mailgun's, Postmark's and Brevo's
/// names for it.
const PROVIDER_EVENT_NAMES: [(&str, [&str; 6]); 8] = [
    (
        "received",
        [
            "processed",
            "Send",
            "email.sent",
            "accepted",
            "Delivery",
            "request",
        ],
    ),
    (
        "delivered",
        [
            "delivered",
            "Delivery",
            "email.delivered",
            "delivered",
            "Delivery",
            "delivered",
        ],
    ),
    (
        "deferred",
        [
            "deferred",
            "DeliveryDelay",
            "email.delivery_delayed",
            "failed",
            "Bounce",
            "deferred",
        ],
    ),
    (
        "bounced",
        [
            "bounce",
            "Bounce",
            "email.bounced",
            "failed",
            "Bounce",
            "hard_bounce",
        ],
    ),
    (
        "complained",
        [
            "spamreport",
            "Complaint",
            "email.complained",
            "complained",
            "SpamComplaint",
            "spam",
        ],
    ),
    (
        "opened",
        ["open", "Open", "email.opened", "opened", "Open", "opened"],
    ),
    (
        "clicked",
        [
            "click",
            "Click",
            "email.clicked",
            "clicked",
            "Click",
            "click",
        ],
    ),
    (
        "unsubscribed",
        [
            "unsubscribe",
            "Subscription",
            "email.unsubscribed",
            "unsubscribed",
            "SubscriptionChange",
            "unsubscribed",
        ],
    ),
];

#[derive(Clone, Copy)]
enum EmailProvider {
    Sendgrid,
    Ses,
    Resend,
    Mailgun,
    Postmark,
    Brevo,
}

/// The provider's name for the event, or the event type as it is when it is not an outcome.
fn name_for_provider(event_type: String, email_provider: EmailProvider) -> String {
    let outcome = event_type.strip_prefix("email.").unwrap_or(&event_type);
    PROVIDER_EVENT_NAMES
        .iter()
        .find(|(sendmock_outcome, _)| *sendmock_outcome == outcome)
        .map_or(event_type.clone(), |(_, provider_names)| {
            provider_names[email_provider as usize].to_owned()
        })
}

pub fn sendgrid_event_filter(event_type: String) -> String {
    name_for_provider(event_type, EmailProvider::Sendgrid)
}

pub fn ses_type_filter(event_type: String) -> String {
    name_for_provider(event_type, EmailProvider::Ses)
}

pub fn resend_type_filter(event_type: String) -> String {
    name_for_provider(event_type, EmailProvider::Resend)
}

pub fn mailgun_event_filter(event_type: String) -> String {
    name_for_provider(event_type, EmailProvider::Mailgun)
}

pub fn postmark_record_type_filter(event_type: String) -> String {
    name_for_provider(event_type, EmailProvider::Postmark)
}

pub fn brevo_event_filter(event_type: String) -> String {
    name_for_provider(event_type, EmailProvider::Brevo)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn outcomes_use_each_providers_own_event_names() {
        assert_eq!(sendgrid_event_filter("email.bounced".to_owned()), "bounce");
        assert_eq!(
            sendgrid_event_filter("email.complained".to_owned()),
            "spamreport"
        );
        assert_eq!(ses_type_filter("email.delivered".to_owned()), "Delivery");
        assert_eq!(
            resend_type_filter("email.received".to_owned()),
            "email.sent"
        );
        assert_eq!(sendgrid_event_filter("email.clicked".to_owned()), "click");
        assert_eq!(
            postmark_record_type_filter("email.clicked".to_owned()),
            "Click"
        );
        assert_eq!(mailgun_event_filter("email.clicked".to_owned()), "clicked");
        assert_eq!(sendgrid_event_filter("sms.status".to_owned()), "sms.status");
        assert_eq!(mailgun_event_filter("email.bounced".to_owned()), "failed");
        assert_eq!(
            postmark_record_type_filter("email.complained".to_owned()),
            "SpamComplaint"
        );
        assert_eq!(
            brevo_event_filter("email.bounced".to_owned()),
            "hard_bounce"
        );
    }
}
