use std::collections::BTreeMap;

use mail_parser::{Address, AddressList, HeaderValue, MessageParser, MessagePart};
use sendmock_store::StoredEmailAddress;

use super::mime_tree::{MimeTreeNode, build_mime_tree};

/// A message read into the parts SendMock stores and shows.
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedEmail {
    pub message_id: Option<String>,
    pub subject: String,
    pub from: StoredEmailAddress,
    pub to: Vec<StoredEmailAddress>,
    pub cc: Vec<StoredEmailAddress>,
    pub reply_to: Vec<StoredEmailAddress>,
    /// Header values by name, in document order; folded lines are joined.
    pub headers: BTreeMap<String, Vec<String>>,
    pub text_body: Option<String>,
    pub html_body: Option<String>,
    pub attachments: Vec<ParsedAttachment>,
    pub mime_tree: MimeTreeNode,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedAttachment {
    pub filename: String,
    pub content_type: String,
    pub content_id: Option<String>,
    pub is_inline: bool,
    pub content: Vec<u8>,
}

/// Parses any message; broken mail still gives a result, with what could be read.
pub fn parse_email(raw_message: &[u8]) -> ParsedEmail {
    let Some(message) = MessageParser::new().parse(raw_message) else {
        return ParsedEmail::from_unreadable(raw_message);
    };
    let attachments = message
        .root()
        .parts()
        .filter(|message_part| is_attachment_part(*message_part))
        .enumerate()
        .map(|(attachment_position, attachment_part)| ParsedAttachment {
            filename: attachment_part.attachment_name().map_or_else(
                || format!("attachment-{}", attachment_position + 1),
                str::to_owned,
            ),
            content_type: attachment_part.content_type().map_or_else(
                || "application/octet-stream".to_owned(),
                |content_type| match content_type.subtype() {
                    Some(subtype) => format!("{}/{}", content_type.ctype(), subtype).to_lowercase(),
                    None => content_type.ctype().to_lowercase(),
                },
            ),
            content_id: attachment_part
                .content_id()
                .map(|content_id| content_id.trim_matches(['<', '>']).to_owned()),
            is_inline: attachment_part.is_inline(),
            content: attachment_part.decoded().into_owned(),
        })
        .collect();
    ParsedEmail {
        message_id: message.message_id().map(str::to_owned),
        subject: message.subject().unwrap_or_default().to_owned(),
        from: message
            .from()
            .and_then(|address_list| to_stored_addresses(address_list).into_iter().next())
            .unwrap_or_default(),
        to: message.to().map(to_stored_addresses).unwrap_or_default(),
        cc: message.cc().map(to_stored_addresses).unwrap_or_default(),
        reply_to: message
            .reply_to()
            .map(to_stored_addresses)
            .unwrap_or_default(),
        headers: read_headers(&message),
        text_body: message.body_text(0).map(|text| text.into_owned()),
        html_body: message.body_html(0).map(|html| html.into_owned()),
        attachments,
        mime_tree: build_mime_tree(message.root_part(), "1".to_owned()),
    }
}

impl ParsedEmail {
    fn from_unreadable(raw_message: &[u8]) -> Self {
        Self {
            message_id: None,
            subject: String::new(),
            from: StoredEmailAddress::default(),
            to: Vec::new(),
            cc: Vec::new(),
            reply_to: Vec::new(),
            headers: BTreeMap::new(),
            text_body: Some(String::from_utf8_lossy(raw_message).into_owned()),
            html_body: None,
            attachments: Vec::new(),
            mime_tree: MimeTreeNode {
                part_id: "1".to_owned(),
                content_type: "text/plain".to_owned(),
                transfer_encoding: None,
                charset: None,
                size_bytes: u64::try_from(raw_message.len()).unwrap_or_default(),
                filename: None,
                content_id: None,
                children: Vec::new(),
            },
        }
    }
}

/// Every part that is not structure and not the text or HTML body: attachments, inline
/// images (which RFC 8621 counts as body) and attached messages.
fn is_attachment_part(message_part: MessagePart<'_>) -> bool {
    if message_part.is_multipart() {
        return false;
    }
    let is_body_text = message_part.is_text()
        && message_part.attachment_name().is_none()
        && (message_part.in_text_body() || message_part.in_html_body());
    !is_body_text
}

fn to_stored_addresses(address_list: AddressList<'_>) -> Vec<StoredEmailAddress> {
    address_list
        .iter()
        .flat_map(|address| match address {
            Address::Mailbox(mailbox) => vec![mailbox],
            Address::Group(group) => group.mailboxes().collect(),
        })
        .map(|mailbox| StoredEmailAddress {
            name: mailbox.name().unwrap_or_default().to_owned(),
            address: mailbox.address().unwrap_or_default().to_owned(),
        })
        .collect()
}

/// Decoded text for unstructured headers; the value as written, unfolded, for the rest.
fn read_headers(message: &mail_parser::Message<'_>) -> BTreeMap<String, Vec<String>> {
    let mut headers: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for header in message.headers().iter() {
        let header_text = match header.value() {
            HeaderValue::Text(decoded_text) => decoded_text.to_owned(),
            _ => unfold(&String::from_utf8_lossy(header.raw_value())),
        };
        headers
            .entry(header.raw_name().to_owned())
            .or_default()
            .push(header_text);
    }
    headers
}

fn unfold(header_value: &str) -> String {
    header_value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    const MULTIPART_MESSAGE: &str = "From: Shop <no-reply@shop.test>\r\nTo: Sam <sam@example.test>, ops@example.test\r\nCc: manager@example.test\r\nSubject: =?UTF-8?B?4KaG4Kaq4Kao4Ka+4KawIOCmhuCmpuCnh+Cmtg==?=\r\nMessage-ID: <order-1042@shop.test>\r\nX-Tags: orders, qa\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"outer\"\r\n\r\n--outer\r\nContent-Type: multipart/alternative; boundary=\"inner\"\r\n\r\n--inner\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nYour code is 482913.\r\n--inner\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Your code is <b>482913</b>.</p>\r\n--inner--\r\n--outer\r\nContent-Type: application/pdf; name=\"invoice.pdf\"\r\nContent-Disposition: attachment; filename=\"invoice.pdf\"\r\nContent-Transfer-Encoding: base64\r\n\r\nJVBERi0xLjQK\r\n--outer--\r\n";

    #[test]
    fn reads_addresses_subject_and_bodies() {
        let parsed_email = parse_email(MULTIPART_MESSAGE.as_bytes());

        assert_eq!(
            parsed_email.from,
            StoredEmailAddress {
                name: "Shop".to_owned(),
                address: "no-reply@shop.test".to_owned()
            }
        );
        assert_eq!(parsed_email.to.len(), 2);
        assert_eq!(parsed_email.to[1].address, "ops@example.test");
        assert_eq!(parsed_email.cc[0].address, "manager@example.test");
        assert_eq!(
            parsed_email.message_id.as_deref(),
            Some("order-1042@shop.test")
        );
        assert_eq!(
            parsed_email.text_body.as_deref().map(str::trim),
            Some("Your code is 482913.")
        );
        assert!(
            parsed_email
                .html_body
                .is_some_and(|html| html.contains("<b>482913</b>"))
        );
    }

    // AC: EM-04.8
    #[test]
    fn decodes_a_non_english_subject() {
        assert_eq!(
            parse_email(MULTIPART_MESSAGE.as_bytes()).subject,
            "আপনার আদেশ"
        );
    }

    #[test]
    fn reads_attachments_and_the_mime_tree() {
        let parsed_email = parse_email(MULTIPART_MESSAGE.as_bytes());

        assert_eq!(parsed_email.attachments.len(), 1);
        assert_eq!(parsed_email.attachments[0].filename, "invoice.pdf");
        assert_eq!(parsed_email.attachments[0].content_type, "application/pdf");
        assert_eq!(parsed_email.attachments[0].content, b"%PDF-1.4\n");
        assert_eq!(parsed_email.mime_tree.content_type, "multipart/mixed");
        assert_eq!(parsed_email.mime_tree.children.len(), 2);
        assert_eq!(
            parsed_email.mime_tree.children[0].children[1].part_id,
            "1.1.2"
        );
    }

    #[test]
    fn keeps_every_header_by_name() {
        let parsed_email = parse_email(MULTIPART_MESSAGE.as_bytes());

        assert_eq!(
            parsed_email.headers.get("X-Tags"),
            Some(&vec!["orders, qa".to_owned()])
        );
    }

    // AC: EM-04.8
    #[test]
    fn broken_mail_still_parses_without_errors() {
        let parsed_email = parse_email(b"this is not a message at all");

        assert!(parsed_email.text_body.is_some());
    }
}
