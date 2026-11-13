use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use schemars::JsonSchema;
use sendmock_mail::{decompress_raw_message, parse_email};
use sendmock_store::EmailRecord;
use serde::Deserialize;

use super::email_access::find_email_or_not_found;
use super::email_detail::EmailDetail;
use super::email_response_store::{
    EmailResponseSpec, check_original_is_outbound, store_email_response,
};
use super::native_send_request::{NativeSendAttachment, read_bare_address};
use super::response_text::format_address;
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, SuccessStatus,
};

/// When the original has no recipient to reply as.
const FALLBACK_RESPONDER: &str = "recipient@example.com";

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailReplyInput {
    pub email_id: String,
    /// The reply text, above the quoted original; empty or left out sends no text of
    /// its own.
    pub body: Option<String>,
    /// Who replies; defaults to the original recipient.
    pub from: Option<String>,
    /// Defaults to `Re: <original subject>`.
    pub subject: Option<String>,
    /// Also sends to the other original recipients, in Cc.
    pub reply_all: Option<bool>,
    /// Quotes the original below an "On ... wrote:" line (default true).
    pub include_original: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailForwardInput {
    pub email_id: String,
    /// Where the email is forwarded, e.g. your app's inbound address.
    pub to: String,
    /// A note above the forwarded message.
    pub body: Option<String>,
    /// Who forwards; defaults to the original recipient.
    pub from: Option<String>,
    /// Defaults to `Fwd: <original subject>`.
    pub subject: Option<String>,
    /// Adds the original below a "Forwarded message" block (default true).
    pub include_original: Option<bool>,
    /// Forwards the original attachments too (default true).
    pub include_attachments: Option<bool>,
}

fn invalid_input(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

/// The given sender, or the original's first recipient.
fn read_responder(original_email: &EmailRecord, from_text: Option<&str>) -> String {
    match from_text
        .map(str::trim)
        .filter(|from_text| !from_text.is_empty())
    {
        Some(from_text) => from_text.to_owned(),
        None => original_email
            .to
            .first()
            .map_or_else(|| FALLBACK_RESPONDER.to_owned(), format_address),
    }
}

async fn find_original(
    operation_context: &OperationContext,
    email_id: &str,
) -> Result<EmailRecord, OperationError> {
    let original_email = find_email_or_not_found(operation_context, email_id).await?;
    check_original_is_outbound(&original_email)?;
    Ok(original_email)
}

pub struct ReplyToEmailOperation;

impl Operation for ReplyToEmailOperation {
    type Input = EmailReplyInput;
    type Output = EmailDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postEmailsByEmailIdReply",
            method: HttpMethod::Post,
            path: "/api/v1/emails/{emailId}/reply",
            summary: "Reply as the recipient; the reply arrives as inbound email.",
            cli_usage: "sendmock email reply <emailId>",
            mcp_tool: "sendmock_email_reply",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// To the original `Reply-To` (or `From`); Reply all copies the other recipients (EM-17.1,
    /// EM-17.4).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReplyInput,
    ) -> Result<EmailDetail, OperationError> {
        let original_email = find_original(operation_context, &input.email_id).await?;
        let responder = read_responder(&original_email, input.from.as_deref());
        let responder_address = read_bare_address(&responder);
        let reply_recipient = original_email
            .reply_to
            .first()
            .unwrap_or(&original_email.from);
        let other_recipients = if input.reply_all == Some(true) {
            original_email
                .to
                .iter()
                .chain(&original_email.cc)
                .filter(|recipient| recipient.address != responder_address)
                .map(format_address)
                .collect()
        } else {
            Vec::new()
        };
        let response_spec = EmailResponseSpec {
            is_forward: false,
            from: responder,
            to: vec![format_address(reply_recipient)],
            cc: other_recipients,
            subject: input.subject,
            body: input.body.unwrap_or_default(),
            includes_original_text: input.include_original.unwrap_or(true),
            attachments: Vec::new(),
        };
        store_email_response(operation_context, &original_email, response_spec).await
    }
}

/// The original's attachments as a send carries them.
async fn read_original_attachments(
    operation_context: &OperationContext,
    original_email: &EmailRecord,
) -> Result<Vec<NativeSendAttachment>, OperationError> {
    let compressed_raw_message = operation_context
        .email_repository
        .read_compressed_raw_message(&original_email.email_id)
        .await?
        .unwrap_or_default();
    let raw_message = decompress_raw_message(&compressed_raw_message)
        .map_err(|decode_error| OperationError::Internal(decode_error.to_string()))?;
    Ok(parse_email(&raw_message)
        .attachments
        .into_iter()
        .map(|attachment| NativeSendAttachment {
            filename: attachment.filename,
            content: STANDARD.encode(&attachment.content),
            content_type: Some(attachment.content_type),
            content_id: attachment.content_id,
        })
        .collect())
}

pub struct ForwardEmailOperation;

impl Operation for ForwardEmailOperation {
    type Input = EmailForwardInput;
    type Output = EmailDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postEmailsByEmailIdForward",
            method: HttpMethod::Post,
            path: "/api/v1/emails/{emailId}/forward",
            summary: "Forward as the recipient; the copy arrives as inbound email.",
            cli_usage: "sendmock email forward <emailId>",
            mcp_tool: "sendmock_email_forward",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// With the original below a forwarded-message block and its attachments unless turned
    /// off (EM-17.4).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailForwardInput,
    ) -> Result<EmailDetail, OperationError> {
        let original_email = find_original(operation_context, &input.email_id).await?;
        if !read_bare_address(&input.to).contains('@') {
            return Err(invalid_input("to", "Enter the address to forward to"));
        }
        let attachments = if input.include_attachments.unwrap_or(true) {
            read_original_attachments(operation_context, &original_email).await?
        } else {
            Vec::new()
        };
        let response_spec = EmailResponseSpec {
            is_forward: true,
            from: read_responder(&original_email, input.from.as_deref()),
            to: vec![input.to.trim().to_owned()],
            cc: Vec::new(),
            subject: input.subject,
            body: input.body.unwrap_or_default(),
            includes_original_text: input.include_original.unwrap_or(true),
            attachments,
        };
        store_email_response(operation_context, &original_email, response_spec).await
    }
}
