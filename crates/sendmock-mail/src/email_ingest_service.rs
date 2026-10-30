use std::sync::Arc;

use sendmock_core::{Clock, IdGenerator};
use sendmock_store::{
    AttachmentRecord, EmailRecord, EmailRepository, NewAttachmentRecord, NewEmailRecord,
    StoredEmailAddress, TimelineRecord,
};

use crate::extraction::{
    OtpExtractor, extract_header_tags, extract_links, extract_plus_address_tags,
};
use crate::parsing::{ParsedEmail, parse_email};
use crate::raw_message_codec::compress_raw_message;
use crate::{IncomingEmail, MailError};

const SNIPPET_LENGTH: usize = 200;

/// The settings ingest follows, read from Settings by the caller.
#[derive(Debug, Clone)]
pub struct IngestOptions {
    pub otp_extractor: OtpExtractor,
    pub is_plus_address_tagging_enabled: bool,
}

impl Default for IngestOptions {
    fn default() -> Self {
        Self {
            otp_extractor: OtpExtractor::with_default_patterns(),
            is_plus_address_tagging_enabled: true,
        }
    }
}

/// Turns raw bytes and an envelope into a stored email: parsed, compressed, tagged, with
/// its codes and links extracted. SMTP, `sendmail` and every HTTP send path come here.
#[derive(Clone)]
pub struct EmailIngestService {
    email_repository: EmailRepository,
    clock: Arc<dyn Clock>,
    id_generator: Arc<dyn IdGenerator>,
}

impl EmailIngestService {
    pub fn new(
        email_repository: EmailRepository,
        clock: Arc<dyn Clock>,
        id_generator: Arc<dyn IdGenerator>,
    ) -> Self {
        Self {
            email_repository,
            clock,
            id_generator,
        }
    }

    /// Stores the email and answers it as stored.
    pub async fn ingest(
        &self,
        incoming_email: IncomingEmail,
        ingest_options: &IngestOptions,
    ) -> Result<EmailRecord, MailError> {
        let parsed_email = parse_email(&incoming_email.raw_message);
        let email_id = self.id_generator.generate_id().to_string();
        let received_at_unix_ms = self.clock.now_unix_ms();
        let email = build_email_record(
            &email_id,
            received_at_unix_ms,
            &incoming_email,
            &parsed_email,
            ingest_options,
        );
        let attachments = parsed_email
            .attachments
            .into_iter()
            .zip(email.attachments.iter().cloned())
            .map(|(parsed_attachment, attachment)| NewAttachmentRecord {
                attachment,
                content: parsed_attachment.content,
            })
            .collect();
        self.email_repository
            .insert_email(NewEmailRecord {
                email: email.clone(),
                compressed_raw_message: compress_raw_message(&incoming_email.raw_message)?,
                attachments,
            })
            .await?;
        self.email_repository
            .add_timeline_entry(
                &email_id,
                TimelineRecord {
                    kind: "received".to_owned(),
                    happened_at_unix_ms: received_at_unix_ms,
                    detail: format!("Received through {}", incoming_email.source),
                },
            )
            .await?;
        Ok(email)
    }
}

fn build_email_record(
    email_id: &str,
    received_at_unix_ms: i64,
    incoming_email: &IncomingEmail,
    parsed_email: &ParsedEmail,
    ingest_options: &IngestOptions,
) -> EmailRecord {
    let readable_text = parsed_email
        .text_body
        .clone()
        .or_else(|| {
            parsed_email
                .html_body
                .as_deref()
                .map(mail_parser::html_to_text)
        })
        .unwrap_or_default();
    EmailRecord {
        email_id: email_id.to_owned(),
        received_at_unix_ms,
        message_id: parsed_email.message_id.clone(),
        subject: parsed_email.subject.clone(),
        from: parsed_email.from.clone(),
        to: parsed_email.to.clone(),
        cc: parsed_email.cc.clone(),
        bcc: find_blind_copies(&incoming_email.envelope.recipients, parsed_email),
        reply_to: parsed_email.reply_to.clone(),
        envelope_from: incoming_email.envelope.mail_from.clone(),
        envelope_to: incoming_email.envelope.recipients.clone(),
        headers: parsed_email.headers.clone(),
        text_body: parsed_email.text_body.clone(),
        html_body: parsed_email.html_body.clone(),
        snippet: build_snippet(&readable_text),
        size_bytes: u64::try_from(incoming_email.raw_message.len()).unwrap_or_default(),
        is_read: false,
        tags: collect_tags(incoming_email, parsed_email, ingest_options),
        source: incoming_email.source.clone(),
        direction: incoming_email.direction.clone(),
        delivery_status: None,
        open_count: 0,
        opened_at_unix_ms: None,
        otp_codes: ingest_options.otp_extractor.extract_codes(&readable_text),
        links: extract_links(
            parsed_email.text_body.as_deref(),
            parsed_email.html_body.as_deref(),
        ),
        smtp_session_id: incoming_email.smtp_session_id.clone(),
        smtp_auth_user: incoming_email.smtp_auth_user.clone(),
        mime_tree_json: serde_json::to_string(&parsed_email.mime_tree)
            .unwrap_or_else(|_| "null".to_owned()),
        attachments: build_attachment_records(parsed_email),
    }
}

fn build_attachment_records(parsed_email: &ParsedEmail) -> Vec<AttachmentRecord> {
    parsed_email
        .attachments
        .iter()
        .enumerate()
        .map(|(attachment_index, parsed_attachment)| AttachmentRecord {
            attachment_index: u32::try_from(attachment_index).unwrap_or(u32::MAX),
            filename: parsed_attachment.filename.clone(),
            content_type: parsed_attachment.content_type.clone(),
            size_bytes: u64::try_from(parsed_attachment.content.len()).unwrap_or_default(),
            content_id: parsed_attachment.content_id.clone(),
            is_inline: parsed_attachment.is_inline,
        })
        .collect()
}

/// Envelope recipients that no To or Cc header names were sent a blind copy.
fn find_blind_copies(
    envelope_recipients: &[String],
    parsed_email: &ParsedEmail,
) -> Vec<StoredEmailAddress> {
    let header_recipients: Vec<String> = parsed_email
        .to
        .iter()
        .chain(&parsed_email.cc)
        .map(|recipient| recipient.address.to_lowercase())
        .collect();
    envelope_recipients
        .iter()
        .filter(|envelope_recipient| {
            !header_recipients.contains(&envelope_recipient.to_lowercase())
        })
        .map(|envelope_recipient| StoredEmailAddress {
            name: String::new(),
            address: envelope_recipient.clone(),
        })
        .collect()
}

fn collect_tags(
    incoming_email: &IncomingEmail,
    parsed_email: &ParsedEmail,
    ingest_options: &IngestOptions,
) -> Vec<String> {
    let mut tags = extract_header_tags(
        parsed_email
            .headers
            .get("X-Tags")
            .map(Vec::as_slice)
            .unwrap_or_default(),
    );
    if ingest_options.is_plus_address_tagging_enabled {
        let recipient_addresses = parsed_email
            .to
            .iter()
            .chain(&parsed_email.cc)
            .map(|recipient| recipient.address.as_str())
            .chain(
                incoming_email
                    .envelope
                    .recipients
                    .iter()
                    .map(String::as_str),
            );
        tags.extend(extract_plus_address_tags(recipient_addresses));
    }
    tags.extend(
        incoming_email
            .extra_tags
            .iter()
            .map(|tag| tag.to_lowercase()),
    );
    let mut unique_tags: Vec<String> = Vec::new();
    for tag in tags {
        if !unique_tags.contains(&tag) {
            unique_tags.push(tag);
        }
    }
    unique_tags
}

fn build_snippet(readable_text: &str) -> String {
    readable_text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(SNIPPET_LENGTH)
        .collect()
}
