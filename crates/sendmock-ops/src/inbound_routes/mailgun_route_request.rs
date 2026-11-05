//! The request a route's `forward(url)` or `store(notify)` sends: Mailgun's parsed-message
//! fields as `multipart/form-data`, signed as Mailgun signs them (WH-12.2, WH-12.3).

use std::collections::BTreeMap;

use sendmock_mail::{ParsedAttachment, strip_reply_text};
use sendmock_store::EmailRecord;
use sendmock_webhooks::{MultipartPart, sign_mailgun_token, write_multipart_body};

use crate::sms::RecordedHttpRequest;

/// Mailgun's token is 50 lowercase hex characters.
const TOKEN_LENGTH: usize = 50;

/// What one route request carries beyond the email.
pub struct MailgunRouteDetails<'details> {
    pub url: &'details str,
    pub recipient: &'details str,
    pub signing_key: &'details str,
    pub timestamp_seconds: i64,
    /// Random bits for the token and the multipart boundary.
    pub random_words: [u64; 4],
    /// `message-url` for a stored message's notification.
    pub message_url: Option<String>,
    pub raw_message: &'details [u8],
    pub attachments: &'details [ParsedAttachment],
    /// SendMock's own download URL for the email's attachments, without the index; the
    /// sender fetches each one when the request is sent.
    pub attachment_url_base: String,
}

fn format_address(stored_email: &EmailRecord) -> String {
    if stored_email.from.name.is_empty() {
        stored_email.from.address.clone()
    } else {
        format!("{} <{}>", stored_email.from.name, stored_email.from.address)
    }
}

fn build_token(random_words: [u64; 4]) -> String {
    let mut token: String = random_words
        .iter()
        .map(|word| format!("{word:016x}"))
        .collect();
    token.truncate(TOKEN_LENGTH);
    token
}

/// The parsed fields, or `body-mime` with the raw message for a URL ending in `mime`.
fn build_message_fields(
    stored_email: &EmailRecord,
    details: &MailgunRouteDetails<'_>,
) -> Vec<(String, String)> {
    let mut fields = vec![
        ("recipient".to_owned(), details.recipient.to_owned()),
        ("sender".to_owned(), stored_email.from.address.clone()),
        ("from".to_owned(), format_address(stored_email)),
        ("subject".to_owned(), stored_email.subject.clone()),
    ];
    if details.url.trim_end_matches('/').ends_with("mime") {
        fields.push((
            "body-mime".to_owned(),
            String::from_utf8_lossy(details.raw_message).into_owned(),
        ));
        return fields;
    }
    let text_body = stored_email.text_body.clone().unwrap_or_default();
    let (stripped_text, stripped_signature) = strip_reply_text(&text_body);
    let html_body = stored_email.html_body.clone().unwrap_or_default();
    let message_headers: Vec<[&str; 2]> = stored_email
        .headers
        .iter()
        .flat_map(|(header_name, header_values)| {
            header_values
                .iter()
                .map(move |header_value| [header_name.as_str(), header_value.as_str()])
        })
        .collect();
    fields.extend([
        ("body-plain".to_owned(), text_body),
        ("stripped-text".to_owned(), stripped_text),
        ("stripped-signature".to_owned(), stripped_signature),
        ("body-html".to_owned(), html_body.clone()),
        ("stripped-html".to_owned(), html_body),
        (
            "attachment-count".to_owned(),
            details.attachments.len().to_string(),
        ),
        (
            "message-headers".to_owned(),
            serde_json::to_string(&message_headers).unwrap_or_default(),
        ),
        (
            "content-id-map".to_owned(),
            build_content_id_map(details.attachments),
        ),
    ]);
    fields
}

fn build_content_id_map(attachments: &[ParsedAttachment]) -> String {
    let content_ids: BTreeMap<String, String> = attachments
        .iter()
        .enumerate()
        .filter_map(|(attachment_index, attachment)| {
            let content_id = attachment.content_id.as_ref()?;
            Some((
                format!("<{content_id}>"),
                format!("attachment-{}", attachment_index + 1),
            ))
        })
        .collect();
    serde_json::to_string(&content_ids).unwrap_or_default()
}

/// Each attachment as `attachment-N`, fetched from SendMock's own download URL when sent.
fn build_attachment_parts(details: &MailgunRouteDetails<'_>) -> Vec<MultipartPart> {
    details
        .attachments
        .iter()
        .enumerate()
        .map(
            |(attachment_index, attachment)| MultipartPart::FileFromUrl {
                name: format!("attachment-{}", attachment_index + 1),
                file_name: attachment.filename.clone(),
                url: format!("{}/{attachment_index}", details.attachment_url_base),
            },
        )
        .collect()
}

/// The multipart request, with `timestamp`, `token` and `signature` last as Mailgun sends them.
pub fn build_mailgun_route_request(
    stored_email: &EmailRecord,
    details: &MailgunRouteDetails<'_>,
) -> RecordedHttpRequest {
    let boundary = format!(
        "sendmock-{:016x}{:016x}",
        details.random_words[0], details.random_words[3]
    );
    let timestamp = details.timestamp_seconds.to_string();
    let token = build_token(details.random_words);
    let mut fields = build_message_fields(stored_email, details);
    if let Some(message_url) = &details.message_url {
        fields.push(("message-url".to_owned(), message_url.clone()));
    }
    fields.extend([
        (
            "signature".to_owned(),
            sign_mailgun_token(details.signing_key, &timestamp, &token),
        ),
        ("timestamp".to_owned(), timestamp),
        ("token".to_owned(), token),
    ]);
    let carries_files = !details.url.trim_end_matches('/').ends_with("mime");
    let mut parts: Vec<MultipartPart> = fields
        .into_iter()
        .map(|(name, value)| MultipartPart::Text { name, value })
        .collect();
    if carries_files {
        parts.extend(build_attachment_parts(details));
    }
    let body = write_multipart_body(&boundary, &parts);
    RecordedHttpRequest {
        method: "POST".to_owned(),
        url: details.url.to_owned(),
        headers: BTreeMap::from([
            (
                "content-type".to_owned(),
                format!("multipart/form-data; boundary={boundary}"),
            ),
            ("user-agent".to_owned(), "mailgun/treq-sendmock".to_owned()),
        ]),
        body,
    }
}
