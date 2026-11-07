//! Mailpit's API shapes (`swagger.json` at `v1.33.0`), built from SendMock's email records.

use std::collections::BTreeMap;

use sendmock_core::{FileChecksums, format_rfc3339};
use sendmock_store::{AttachmentRecord, EmailRecord, StoredEmailAddress};
use serde::Serialize;

use super::super::list_unsubscribe_report::check_list_unsubscribe;
use super::super::mime_part::MimePart;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MailpitAddress {
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Address")]
    pub address: String,
}

impl From<&StoredEmailAddress> for MailpitAddress {
    fn from(stored_address: &StoredEmailAddress) -> Self {
        Self {
            name: stored_address.name.clone(),
            address: stored_address.address.clone(),
        }
    }
}

fn to_mailpit_addresses(stored_addresses: &[StoredEmailAddress]) -> Vec<MailpitAddress> {
    stored_addresses.iter().map(MailpitAddress::from).collect()
}

/// One message in a list, as `GET /api/v1/messages` gives it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MailpitMessageSummary {
    #[serde(rename = "ID")]
    pub id: String,
    #[serde(rename = "MessageID")]
    pub message_id: String,
    #[serde(rename = "Read")]
    pub is_read: bool,
    #[serde(rename = "From")]
    pub from: MailpitAddress,
    #[serde(rename = "To")]
    pub to: Vec<MailpitAddress>,
    #[serde(rename = "Cc")]
    pub cc: Vec<MailpitAddress>,
    #[serde(rename = "Bcc")]
    pub bcc: Vec<MailpitAddress>,
    #[serde(rename = "ReplyTo")]
    pub reply_to: Vec<MailpitAddress>,
    #[serde(rename = "Subject")]
    pub subject: String,
    #[serde(rename = "Created")]
    pub created: String,
    #[serde(rename = "Username")]
    pub username: String,
    #[serde(rename = "Tags")]
    pub tags: Vec<String>,
    #[serde(rename = "Size")]
    pub size_bytes: u64,
    #[serde(rename = "Attachments")]
    pub attachment_count: u64,
    #[serde(rename = "Snippet")]
    pub snippet: String,
}

impl From<&EmailRecord> for MailpitMessageSummary {
    fn from(email: &EmailRecord) -> Self {
        Self {
            id: email.email_id.clone(),
            message_id: read_message_id(email),
            is_read: email.is_read,
            from: MailpitAddress::from(&email.from),
            to: to_mailpit_addresses(&email.to),
            cc: to_mailpit_addresses(&email.cc),
            bcc: to_mailpit_addresses(&email.bcc),
            reply_to: to_mailpit_addresses(&email.reply_to),
            subject: email.subject.clone(),
            created: format_rfc3339(email.received_at_unix_ms),
            username: email.smtp_auth_user.clone().unwrap_or_default(),
            tags: email.tags.clone(),
            size_bytes: email.size_bytes,
            attachment_count: email
                .attachments
                .iter()
                .filter(|attachment| !attachment.is_inline)
                .count() as u64,
            snippet: email.snippet.clone(),
        }
    }
}

/// Mailpit gives the Message-ID without its angle brackets.
fn read_message_id(email: &EmailRecord) -> String {
    email
        .message_id
        .as_deref()
        .unwrap_or_default()
        .trim_start_matches('<')
        .trim_end_matches('>')
        .to_owned()
}

/// `GET /api/v1/messages` and `GET /api/v1/search`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MailpitMessagesSummary {
    pub total: u64,
    pub unread: u64,
    pub messages_count: u64,
    pub messages_unread: u64,
    pub start: u64,
    pub tags: Vec<String>,
    pub messages: Vec<MailpitMessageSummary>,
}

/// An attachment or inline part. `PartID` is SendMock's attachment position, which
/// `GET /api/v1/message/{ID}/part/{PartID}` takes back.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct MailpitChecksums {
    #[serde(rename = "MD5")]
    pub md5: String,
    #[serde(rename = "SHA1")]
    pub sha1: String,
    #[serde(rename = "SHA256")]
    pub sha256: String,
}

impl From<&FileChecksums> for MailpitChecksums {
    fn from(file_checksums: &FileChecksums) -> Self {
        Self {
            md5: file_checksums.md5.clone(),
            sha1: file_checksums.sha1.clone(),
            sha256: file_checksums.sha256.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MailpitAttachment {
    #[serde(rename = "PartID")]
    pub part_id: String,
    #[serde(rename = "FileName")]
    pub file_name: String,
    #[serde(rename = "ContentType")]
    pub content_type: String,
    #[serde(rename = "ContentID")]
    pub content_id: String,
    #[serde(rename = "Size")]
    pub size_bytes: u64,
    #[serde(rename = "Checksums")]
    pub checksums: MailpitChecksums,
}

/// Each attachment's checksums by its position, read from its stored content.
pub type ChecksumsByIndex = BTreeMap<u32, FileChecksums>;

fn build_attachment(
    attachment: &AttachmentRecord,
    checksums_by_index: &ChecksumsByIndex,
) -> MailpitAttachment {
    MailpitAttachment {
        part_id: attachment.attachment_index.to_string(),
        file_name: attachment.filename.clone(),
        content_type: attachment.content_type.clone(),
        content_id: attachment.content_id.clone().unwrap_or_default(),
        size_bytes: attachment.size_bytes,
        checksums: checksums_by_index
            .get(&attachment.attachment_index)
            .map(MailpitChecksums::from)
            .unwrap_or_default(),
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MailpitListUnsubscribe {
    #[serde(rename = "Header")]
    pub header: String,
    #[serde(rename = "HeaderPost")]
    pub header_post: String,
    #[serde(rename = "Links")]
    pub links: Vec<String>,
    #[serde(rename = "Errors")]
    pub errors: String,
}

/// One message, as `GET /api/v1/message/{ID}` gives it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MailpitMessage {
    #[serde(rename = "ID")]
    pub id: String,
    #[serde(rename = "MessageID")]
    pub message_id: String,
    #[serde(rename = "From")]
    pub from: MailpitAddress,
    #[serde(rename = "To")]
    pub to: Vec<MailpitAddress>,
    #[serde(rename = "Cc")]
    pub cc: Vec<MailpitAddress>,
    #[serde(rename = "Bcc")]
    pub bcc: Vec<MailpitAddress>,
    #[serde(rename = "ReplyTo")]
    pub reply_to: Vec<MailpitAddress>,
    #[serde(rename = "ReturnPath")]
    pub return_path: String,
    #[serde(rename = "Subject")]
    pub subject: String,
    #[serde(rename = "ListUnsubscribe")]
    pub list_unsubscribe: MailpitListUnsubscribe,
    #[serde(rename = "Date")]
    pub date: String,
    #[serde(rename = "Tags")]
    pub tags: Vec<String>,
    #[serde(rename = "Username")]
    pub username: String,
    #[serde(rename = "Text")]
    pub text: String,
    #[serde(rename = "HTML")]
    pub html: String,
    #[serde(rename = "Size")]
    pub size_bytes: u64,
    #[serde(rename = "Inline")]
    pub inline: Vec<MailpitAttachment>,
    #[serde(rename = "Attachments")]
    pub attachments: Vec<MailpitAttachment>,
}

fn contains_html_part(mime_part: &MimePart) -> bool {
    let is_html_body =
        mime_part.content_type.starts_with("text/html") && mime_part.filename.is_none();
    is_html_body || mime_part.children.iter().any(contains_html_part)
}

/// The HTML part as Mailpit gives it: `None` for a message that has none. SendMock keeps an HTML
/// rendering of a text-only message for its own preview, which Mailpit does not.
pub fn read_html_part(email: &EmailRecord) -> Option<String> {
    let has_html_part = serde_json::from_str::<MimePart>(&email.mime_tree_json)
        .map_or(true, |mime_tree| contains_html_part(&mime_tree));
    email.html_body.clone().filter(|_| has_html_part)
}

fn read_first_header(email: &EmailRecord, header_name: &str) -> String {
    email
        .headers
        .iter()
        .find(|(stored_name, _)| stored_name.eq_ignore_ascii_case(header_name))
        .and_then(|(_, header_values)| header_values.first().cloned())
        .unwrap_or_default()
}

impl MailpitMessage {
    pub fn build(email: &EmailRecord, checksums_by_index: &ChecksumsByIndex) -> Self {
        let list_unsubscribe_report = check_list_unsubscribe(&email.headers);
        let (inline_parts, attached_parts): (Vec<_>, Vec<_>) = email
            .attachments
            .iter()
            .partition(|attachment| attachment.is_inline);
        Self {
            id: email.email_id.clone(),
            message_id: read_message_id(email),
            from: MailpitAddress::from(&email.from),
            to: to_mailpit_addresses(&email.to),
            cc: to_mailpit_addresses(&email.cc),
            bcc: to_mailpit_addresses(&email.bcc),
            reply_to: to_mailpit_addresses(&email.reply_to),
            return_path: email.envelope_from.clone(),
            subject: email.subject.clone(),
            list_unsubscribe: MailpitListUnsubscribe {
                header: read_first_header(email, "List-Unsubscribe"),
                header_post: read_first_header(email, "List-Unsubscribe-Post"),
                links: list_unsubscribe_report.values,
                errors: list_unsubscribe_report.warnings.join("; "),
            },
            date: format_rfc3339(email.received_at_unix_ms),
            tags: email.tags.clone(),
            username: email.smtp_auth_user.clone().unwrap_or_default(),
            text: email.text_body.clone().unwrap_or_default(),
            html: read_html_part(email).unwrap_or_default(),
            size_bytes: email.size_bytes,
            inline: inline_parts
                .into_iter()
                .map(|attachment| build_attachment(attachment, checksums_by_index))
                .collect(),
            attachments: attached_parts
                .into_iter()
                .map(|attachment| build_attachment(attachment, checksums_by_index))
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn stored_address(name: &str, address: &str) -> StoredEmailAddress {
        StoredEmailAddress {
            name: name.to_owned(),
            address: address.to_owned(),
        }
    }

    fn attachment(attachment_index: u32, filename: &str, is_inline: bool) -> AttachmentRecord {
        AttachmentRecord {
            attachment_index,
            filename: filename.to_owned(),
            content_type: "image/png".to_owned(),
            size_bytes: 120,
            content_id: is_inline.then(|| "logo".to_owned()),
            is_inline,
        }
    }

    fn sample_email() -> EmailRecord {
        EmailRecord {
            email_id: "01JCK0000000000000000000AB".to_owned(),
            received_at_unix_ms: 1_762_500_000_000,
            message_id: Some("<welcome@shop.test>".to_owned()),
            subject: "Welcome".to_owned(),
            from: stored_address("Shop", "hello@shop.test"),
            to: vec![stored_address("", "sam@example.test")],
            cc: Vec::new(),
            bcc: Vec::new(),
            reply_to: Vec::new(),
            envelope_from: "bounce@shop.test".to_owned(),
            envelope_to: vec!["sam@example.test".to_owned()],
            headers: BTreeMap::from([(
                "List-Unsubscribe".to_owned(),
                vec!["<https://shop.test/unsubscribe>".to_owned()],
            )]),
            text_body: Some("Hi Sam".to_owned()),
            html_body: Some("<p>Hi Sam</p>".to_owned()),
            snippet: "Hi Sam".to_owned(),
            size_bytes: 2048,
            is_read: false,
            tags: vec!["welcome".to_owned()],
            source: "smtp".to_owned(),
            direction: "outbound".to_owned(),
            delivery_status: None,
            open_count: 0,
            opened_at_unix_ms: None,
            otp_codes: Vec::new(),
            links: Vec::new(),
            smtp_session_id: None,
            smtp_auth_user: Some("app".to_owned()),
            mime_tree_json: "{}".to_owned(),
            attachments: vec![
                attachment(0, "logo.png", true),
                attachment(1, "invoice.pdf", false),
            ],
        }
    }

    // AC: EM-19.1
    #[test]
    fn a_list_entry_has_mailpits_keys_and_counts_only_real_attachments() {
        let summary_value =
            serde_json::to_value(MailpitMessageSummary::from(&sample_email())).unwrap_or_default();

        assert_eq!(summary_value["ID"], "01JCK0000000000000000000AB");
        assert_eq!(summary_value["MessageID"], "welcome@shop.test");
        assert_eq!(
            summary_value["From"],
            json!({ "Name": "Shop", "Address": "hello@shop.test" })
        );
        assert_eq!(summary_value["Read"], false);
        assert_eq!(summary_value["Attachments"], 1);
        assert_eq!(summary_value["Username"], "app");
        assert_eq!(summary_value["Created"], "2025-11-07T07:20:00Z");
    }

    // AC: EM-19.2
    #[test]
    fn a_message_splits_inline_parts_from_attachments_and_names_their_part_ids() {
        let checksums_by_index =
            ChecksumsByIndex::from([(1, sendmock_core::compute_file_checksums(b"abc"))]);
        let message_value =
            serde_json::to_value(MailpitMessage::build(&sample_email(), &checksums_by_index))
                .unwrap_or_default();

        assert_eq!(message_value["Text"], "Hi Sam");
        assert_eq!(message_value["HTML"], "<p>Hi Sam</p>");
        assert_eq!(message_value["ReturnPath"], "bounce@shop.test");
        assert_eq!(message_value["Inline"][0]["PartID"], "0");
        assert_eq!(message_value["Inline"][0]["ContentID"], "logo");
        assert_eq!(message_value["Attachments"][0]["PartID"], "1");
        assert_eq!(message_value["Attachments"][0]["FileName"], "invoice.pdf");
        assert_eq!(
            message_value["Attachments"][0]["Checksums"]["MD5"],
            "900150983cd24fb0d6963f7d28e17f72"
        );
        assert_eq!(
            message_value["ListUnsubscribe"]["Header"],
            "<https://shop.test/unsubscribe>"
        );
    }

    // AC: EM-19.2
    #[test]
    fn a_text_only_message_has_no_html_part_although_sendmock_renders_one() {
        let text_only_email = EmailRecord {
            mime_tree_json: serde_json::json!({
                "part_id": "1",
                "content_type": "text/plain",
                "transfer_encoding": null,
                "charset": "utf-8",
                "size_bytes": 6,
                "filename": null,
                "content_id": null,
                "children": [],
            })
            .to_string(),
            ..sample_email()
        };

        assert_eq!(read_html_part(&text_only_email), None);
        assert_eq!(
            MailpitMessage::build(&text_only_email, &ChecksumsByIndex::new()).html,
            ""
        );
    }
}
