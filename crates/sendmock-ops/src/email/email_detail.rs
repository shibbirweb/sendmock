use std::collections::BTreeMap;

use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::EmailRecord;
use serde::Serialize;

use super::email_summary::{EmailAddress, to_email_addresses};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct EmailAttachment {
    pub index: u32,
    pub filename: String,
    pub content_type: String,
    pub size_bytes: u64,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub content_id: Option<String>,
    pub is_inline: bool,
    pub download_url: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub thumbnail_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct ExtractedData {
    pub otp: Vec<String>,
    pub links: Vec<String>,
}

/// One email with bodies, headers, attachments and extracted codes. Template data and
/// reply links are null or empty until provider APIs and replies exist.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct EmailDetail {
    pub id: String,
    pub received_at: String,
    pub from: EmailAddress,
    pub to: Vec<EmailAddress>,
    pub subject: String,
    pub snippet: String,
    pub size_bytes: u64,
    pub attachment_count: u64,
    pub is_read: bool,
    pub tags: Vec<String>,
    pub source: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub delivery_status: Option<String>,
    pub open_count: u64,
    pub has_otp: bool,
    pub direction: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub response_kind: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub message_id: Option<String>,
    pub cc: Vec<EmailAddress>,
    pub bcc: Vec<EmailAddress>,
    pub reply_to: Vec<EmailAddress>,
    pub envelope_from: String,
    pub envelope_to: Vec<String>,
    pub headers: BTreeMap<String, Vec<String>>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub text_body: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub html_body: Option<String>,
    pub attachments: Vec<EmailAttachment>,
    pub extracted: ExtractedData,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub opened_at: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub smtp_session_id: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub smtp_auth_user: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<serde_json::Value>")]
    pub template: Option<serde_json::Value>,
    #[schemars(required, schema_with = "crate::nullable_schema::<serde_json::Value>")]
    pub response_to: Option<serde_json::Value>,
    pub responses: Vec<serde_json::Value>,
}

impl From<&EmailRecord> for EmailDetail {
    fn from(email: &EmailRecord) -> Self {
        Self {
            id: email.email_id.clone(),
            received_at: format_rfc3339(email.received_at_unix_ms),
            from: EmailAddress::from(&email.from),
            to: to_email_addresses(&email.to),
            subject: email.subject.clone(),
            snippet: email.snippet.clone(),
            size_bytes: email.size_bytes,
            attachment_count: u64::try_from(email.attachments.len()).unwrap_or_default(),
            is_read: email.is_read,
            tags: email.tags.clone(),
            source: email.source.clone(),
            delivery_status: email.delivery_status.clone(),
            open_count: email.open_count,
            has_otp: !email.otp_codes.is_empty(),
            direction: email.direction.clone(),
            response_kind: None,
            message_id: email.message_id.clone(),
            cc: to_email_addresses(&email.cc),
            bcc: to_email_addresses(&email.bcc),
            reply_to: to_email_addresses(&email.reply_to),
            envelope_from: email.envelope_from.clone(),
            envelope_to: email.envelope_to.clone(),
            headers: email.headers.clone(),
            text_body: email.text_body.clone(),
            html_body: email.html_body.clone(),
            attachments: to_attachments(email),
            extracted: ExtractedData {
                otp: email.otp_codes.clone(),
                links: email.links.clone(),
            },
            opened_at: email.opened_at_unix_ms.map(format_rfc3339),
            smtp_session_id: email.smtp_session_id.clone(),
            smtp_auth_user: email.smtp_auth_user.clone(),
            template: None,
            response_to: None,
            responses: Vec::new(),
        }
    }
}

/// Image attachments get a thumbnail URL; the image itself is the thumbnail.
fn to_attachments(email: &EmailRecord) -> Vec<EmailAttachment> {
    email
        .attachments
        .iter()
        .map(|attachment| EmailAttachment {
            index: attachment.attachment_index,
            filename: attachment.filename.clone(),
            content_type: attachment.content_type.clone(),
            size_bytes: attachment.size_bytes,
            content_id: attachment.content_id.clone(),
            is_inline: attachment.is_inline,
            download_url: format!(
                "/api/v1/emails/{}/attachments/{}",
                email.email_id, attachment.attachment_index
            ),
            thumbnail_url: attachment.content_type.starts_with("image/").then(|| {
                format!(
                    "/api/v1/emails/{}/parts/{}/thumbnail",
                    email.email_id, attachment.attachment_index
                )
            }),
        })
        .collect()
}
