//! SendMock event types in an email provider's own words, for the built-in provider templates
//! (`email.bounced` is SendGrid's `bounce`, SES's `Bounce` and Resend's `email.bounced`).

/// SendMock's outcome, then SendGrid's, SES's and Resend's names for it.
const PROVIDER_EVENT_NAMES: [(&str, &str, &str, &str); 7] = [
    ("received", "processed", "Send", "email.sent"),
    ("delivered", "delivered", "Delivery", "email.delivered"),
    (
        "deferred",
        "deferred",
        "DeliveryDelay",
        "email.delivery_delayed",
    ),
    ("bounced", "bounce", "Bounce", "email.bounced"),
    ("complained", "spamreport", "Complaint", "email.complained"),
    ("opened", "open", "Open", "email.opened"),
    (
        "unsubscribed",
        "unsubscribe",
        "Subscription",
        "email.unsubscribed",
    ),
];

fn find_provider_names(event_type: &str) -> Option<(&'static str, &'static str, &'static str)> {
    let outcome = event_type.strip_prefix("email.").unwrap_or(event_type);
    PROVIDER_EVENT_NAMES
        .iter()
        .find(|(sendmock_outcome, ..)| *sendmock_outcome == outcome)
        .map(|(_, sendgrid_name, ses_name, resend_name)| (*sendgrid_name, *ses_name, *resend_name))
}

pub fn sendgrid_event_filter(event_type: String) -> String {
    find_provider_names(&event_type)
        .map_or(event_type, |(sendgrid_name, ..)| sendgrid_name.to_owned())
}

pub fn ses_type_filter(event_type: String) -> String {
    find_provider_names(&event_type).map_or(event_type, |(_, ses_name, _)| ses_name.to_owned())
}

pub fn resend_type_filter(event_type: String) -> String {
    find_provider_names(&event_type).map_or(event_type, |(.., resend_name)| resend_name.to_owned())
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
        assert_eq!(sendgrid_event_filter("sms.status".to_owned()), "sms.status");
    }
}
