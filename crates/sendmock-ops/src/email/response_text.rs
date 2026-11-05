//! The subject and body a recipient's reply or forward gets, worded as mail clients and the
//! mock word them.

use sendmock_core::format_rfc5322;
use sendmock_store::{EmailRecord, StoredEmailAddress};

/// `Re:` or `Fwd:`, unless the subject already starts with one.
pub fn build_response_subject(original_subject: &str, is_forward: bool) -> String {
    let lowercase_subject = original_subject.trim_start().to_lowercase();
    let has_prefix = if is_forward {
        ["fwd:", "fw:"]
            .iter()
            .any(|prefix| lowercase_subject.starts_with(prefix))
    } else {
        lowercase_subject.starts_with("re:")
    };
    if has_prefix {
        return original_subject.to_owned();
    }
    let prefix = if is_forward { "Fwd:" } else { "Re:" };
    format!("{prefix} {original_subject}").trim().to_owned()
}

pub fn format_address(stored_address: &StoredEmailAddress) -> String {
    if stored_address.name.is_empty() {
        stored_address.address.clone()
    } else {
        format!("{} <{}>", stored_address.name, stored_address.address)
    }
}

/// As JavaScript's `toUTCString()` writes it: `Thu, 05 Nov 2026 10:00:00 GMT`.
fn format_utc_date(unix_ms: i64) -> String {
    format_rfc5322(unix_ms).replace(" +0000", " GMT")
}

fn read_original_text(original_email: &EmailRecord) -> &str {
    original_email
        .text_body
        .as_deref()
        .unwrap_or(&original_email.snippet)
}

/// "On <date>, <sender> wrote:" and the original, each line quoted.
pub fn quote_original_email(original_email: &EmailRecord) -> String {
    let quoted_lines = read_original_text(original_email)
        .split('\n')
        .map(|original_line| format!("> {original_line}"));
    std::iter::once(format!(
        "On {}, {} wrote:",
        format_utc_date(original_email.received_at_unix_ms),
        format_address(&original_email.from)
    ))
    .chain(quoted_lines)
    .collect::<Vec<_>>()
    .join("\n")
}

/// The block mail clients put above a forwarded message.
pub fn build_forwarded_message_block(original_email: &EmailRecord) -> String {
    let original_recipients: Vec<String> = original_email.to.iter().map(format_address).collect();
    [
        "---------- Forwarded message ---------".to_owned(),
        format!("From: {}", format_address(&original_email.from)),
        format!(
            "Date: {}",
            format_utc_date(original_email.received_at_unix_ms)
        ),
        format!("Subject: {}", original_email.subject),
        format!("To: {}", original_recipients.join(", ")),
        String::new(),
        read_original_text(original_email).to_owned(),
    ]
    .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_original_email() -> EmailRecord {
        EmailRecord {
            email_id: "01ORIGINAL".to_owned(),
            received_at_unix_ms: 1_767_225_600_000,
            message_id: None,
            subject: "Your receipt".to_owned(),
            from: StoredEmailAddress {
                name: "Shop".to_owned(),
                address: "shop@example.test".to_owned(),
            },
            to: vec![StoredEmailAddress {
                name: String::new(),
                address: "sam@example.test".to_owned(),
            }],
            cc: Vec::new(),
            bcc: Vec::new(),
            reply_to: Vec::new(),
            envelope_from: "shop@example.test".to_owned(),
            envelope_to: vec!["sam@example.test".to_owned()],
            headers: std::collections::BTreeMap::new(),
            text_body: Some("Thanks\nfor your order".to_owned()),
            html_body: None,
            snippet: "Thanks for your order".to_owned(),
            size_bytes: 0,
            is_read: false,
            tags: Vec::new(),
            source: "smtp".to_owned(),
            direction: "outbound".to_owned(),
            delivery_status: None,
            open_count: 0,
            opened_at_unix_ms: None,
            otp_codes: Vec::new(),
            links: Vec::new(),
            smtp_session_id: None,
            smtp_auth_user: None,
            mime_tree_json: String::new(),
            attachments: Vec::new(),
        }
    }

    // AC: EM-17.1 EM-17.4
    #[test]
    fn prefixes_the_subject_once() {
        assert_eq!(build_response_subject("Invoice", false), "Re: Invoice");
        assert_eq!(build_response_subject("RE: Invoice", false), "RE: Invoice");
        assert_eq!(build_response_subject("Invoice", true), "Fwd: Invoice");
        assert_eq!(build_response_subject("Fw: Invoice", true), "Fw: Invoice");
    }

    // AC: EM-17.1
    #[test]
    fn quotes_the_original_under_an_on_wrote_line() {
        assert_eq!(
            quote_original_email(&build_original_email()),
            "On Thu, 01 Jan 2026 00:00:00 GMT, Shop <shop@example.test> wrote:\n> Thanks\n> for your order"
        );
    }

    // AC: EM-17.4
    #[test]
    fn writes_the_forwarded_message_block() {
        assert_eq!(
            build_forwarded_message_block(&build_original_email()),
            "---------- Forwarded message ---------\nFrom: Shop <shop@example.test>\nDate: Thu, 01 Jan 2026 00:00:00 GMT\nSubject: Your receipt\nTo: sam@example.test\n\nThanks\nfor your order"
        );
    }
}
