//! SendMock event types in an email provider's own words, for the built-in provider templates
//! (`email.delivered` is SendGrid's `delivered`, SES's `Delivered` and Resend's
//! `email.delivered`).

fn strip_email_prefix(event_type: &str) -> &str {
    event_type.strip_prefix("email.").unwrap_or(event_type)
}

pub fn sendgrid_event_filter(event_type: String) -> String {
    strip_email_prefix(&event_type).to_owned()
}

pub fn ses_type_filter(event_type: String) -> String {
    let outcome = strip_email_prefix(&event_type);
    let mut characters = outcome.chars();
    match characters.next() {
        Some(first_character) => first_character.to_uppercase().chain(characters).collect(),
        None => String::new(),
    }
}

pub fn resend_type_filter(event_type: String) -> String {
    format!("email.{}", strip_email_prefix(&event_type))
}
