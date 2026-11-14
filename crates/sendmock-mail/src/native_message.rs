use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;

/// A message described by fields, as the native send API and the inbound API take it.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct NativeMessage {
    pub from: String,
    pub to: Vec<String>,
    pub cc: Vec<String>,
    pub subject: String,
    pub text: Option<String>,
    pub html: Option<String>,
    pub headers: Vec<(String, String)>,
    pub attachments: Vec<NativeAttachment>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NativeAttachment {
    pub filename: String,
    pub content_type: String,
    pub content_id: Option<String>,
    pub content: Vec<u8>,
}

/// The content type a file name suggests, or `application/octet-stream`.
pub fn guess_content_type(filename: &str) -> String {
    mime_guess::from_path(filename)
        .first_or_octet_stream()
        .essence_str()
        .to_owned()
}

/// Builds the RFC 5322 message SMTP would have carried. Bcc recipients never appear in it;
/// they only go into the envelope.
pub fn build_raw_message(
    native_message: &NativeMessage,
    message_id: &str,
    date_header: &str,
) -> Vec<u8> {
    let mut raw_message = String::new();
    push_header(&mut raw_message, "From", &native_message.from);
    push_header(&mut raw_message, "To", &native_message.to.join(", "));
    if !native_message.cc.is_empty() {
        push_header(&mut raw_message, "Cc", &native_message.cc.join(", "));
    }
    push_header(
        &mut raw_message,
        "Subject",
        &encode_header_text(&native_message.subject),
    );
    push_header(&mut raw_message, "Date", date_header);
    push_header(&mut raw_message, "Message-ID", &format!("<{message_id}>"));
    push_header(&mut raw_message, "MIME-Version", "1.0");
    for (header_name, header_value) in &native_message.headers {
        push_header(
            &mut raw_message,
            header_name,
            &encode_header_text(header_value),
        );
    }
    let body_boundary = format!("sendmock-alternative-{message_id}");
    let body_part = build_body_part(native_message, &body_boundary);
    if native_message.attachments.is_empty() {
        raw_message.push_str(&body_part);
        return raw_message.into_bytes();
    }
    let mixed_boundary = format!("sendmock-mixed-{message_id}");
    raw_message.push_str(&format!(
        "Content-Type: multipart/mixed; boundary=\"{mixed_boundary}\"\r\n\r\n"
    ));
    raw_message.push_str(&format!("--{mixed_boundary}\r\n{body_part}\r\n"));
    for attachment in &native_message.attachments {
        raw_message.push_str(&format!(
            "--{mixed_boundary}\r\n{}\r\n",
            build_attachment_part(attachment)
        ));
    }
    raw_message.push_str(&format!("--{mixed_boundary}--\r\n"));
    raw_message.into_bytes()
}

fn build_body_part(native_message: &NativeMessage, alternative_boundary: &str) -> String {
    match (&native_message.text, &native_message.html) {
        (Some(text), Some(html)) => format!(
            "Content-Type: multipart/alternative; boundary=\"{alternative_boundary}\"\r\n\r\n--{alternative_boundary}\r\n{}\r\n--{alternative_boundary}\r\n{}\r\n--{alternative_boundary}--\r\n",
            build_text_part("text/plain", text),
            build_text_part("text/html", html)
        ),
        (None, Some(html)) => build_text_part("text/html", html),
        (text, None) => build_text_part("text/plain", text.as_deref().unwrap_or_default()),
    }
}

fn build_text_part(content_type: &str, body_text: &str) -> String {
    format!(
        "Content-Type: {content_type}; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n{}",
        wrap_base64(body_text.as_bytes())
    )
}

fn build_attachment_part(attachment: &NativeAttachment) -> String {
    let filename = attachment.filename.replace('"', "");
    let disposition = if attachment.content_id.is_some() {
        "inline"
    } else {
        "attachment"
    };
    let content_id_header = attachment
        .content_id
        .as_ref()
        .map(|content_id| format!("Content-ID: <{content_id}>\r\n"))
        .unwrap_or_default();
    format!(
        "Content-Type: {}; name=\"{filename}\"\r\nContent-Disposition: {disposition}; filename=\"{filename}\"\r\n{content_id_header}Content-Transfer-Encoding: base64\r\n\r\n{}",
        attachment.content_type,
        wrap_base64(&attachment.content)
    )
}

/// Base64 in 76-character lines, as MIME requires.
fn wrap_base64(content: &[u8]) -> String {
    let encoded = BASE64.encode(content);
    let lines: Vec<&str> = encoded
        .as_bytes()
        .chunks(76)
        .filter_map(|line| std::str::from_utf8(line).ok())
        .collect();
    format!("{}\r\n", lines.join("\r\n"))
}

/// Non-ASCII header text becomes an RFC 2047 encoded word, so any language survives.
fn encode_header_text(header_text: &str) -> String {
    if header_text.is_ascii() {
        header_text.to_owned()
    } else {
        format!("=?UTF-8?B?{}?=", BASE64.encode(header_text.as_bytes()))
    }
}

fn push_header(raw_message: &mut String, header_name: &str, header_value: &str) {
    let single_line_value = header_value.replace(['\r', '\n'], " ");
    raw_message.push_str(&format!("{header_name}: {single_line_value}\r\n"));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse_email;

    fn order_message() -> NativeMessage {
        NativeMessage {
            from: "Shop <no-reply@shop.test>".to_owned(),
            to: vec!["sam@example.test".to_owned()],
            cc: vec!["manager@example.test".to_owned()],
            subject: "অর্ডার #1042".to_owned(),
            text: Some("Your order shipped.".to_owned()),
            html: Some("<p>Your order <b>shipped</b>.</p>".to_owned()),
            headers: vec![("X-Order-Id".to_owned(), "1042".to_owned())],
            attachments: vec![NativeAttachment {
                filename: "logo.png".to_owned(),
                content_type: guess_content_type("logo.png"),
                content_id: Some("logo".to_owned()),
                content: vec![0x89, b'P', b'N', b'G'],
            }],
        }
    }

    // AC: EM-07.4
    #[test]
    fn builds_a_message_that_parses_back_to_the_same_fields() {
        let raw_message = build_raw_message(
            &order_message(),
            "01J0MSG@sendmock.local",
            "Thu, 29 Oct 2026 10:00:00 +0000",
        );

        let parsed_email = parse_email(&raw_message);

        assert_eq!(parsed_email.subject, "অর্ডার #1042");
        assert_eq!(parsed_email.from.address, "no-reply@shop.test");
        assert_eq!(parsed_email.cc[0].address, "manager@example.test");
        assert_eq!(
            parsed_email.text_body.as_deref().map(str::trim),
            Some("Your order shipped.")
        );
        assert!(
            parsed_email
                .html_body
                .is_some_and(|html| html.contains("<b>shipped</b>"))
        );
        assert_eq!(
            parsed_email.headers.get("X-Order-Id"),
            Some(&vec!["1042".to_owned()])
        );
        assert_eq!(parsed_email.attachments[0].filename, "logo.png");
        assert_eq!(parsed_email.attachments[0].content_type, "image/png");
        assert_eq!(
            parsed_email.attachments[0].content_id.as_deref(),
            Some("logo")
        );
        assert_eq!(
            parsed_email.attachments[0].content,
            [0x89, b'P', b'N', b'G']
        );
    }

    #[test]
    fn guesses_content_types_from_file_names() {
        assert_eq!(guess_content_type("invoice.pdf"), "application/pdf");
        assert_eq!(
            guess_content_type("data.unknownextension"),
            "application/octet-stream"
        );
    }
}
