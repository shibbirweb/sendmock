use schemars::JsonSchema;
use sendmock_mail::{EmailEnvelope, parse_email};
use serde::Deserialize;

use super::inbound_email_store::{store_inbound_message, store_inbound_raw_message};
use super::lookups::NativeSendResult;
use super::native_send_request::NativeSendRequest;
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, SuccessStatus,
    complete_email_intake,
};

/// Body of `POST /api/v1/emails/inbound`: an incoming email from fields, or raw MIME in `raw`.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct EmailInboundRequest {
    /// The sender, as an address or `Name <address>`.
    pub from: Option<String>,
    /// The recipients, usually your app's inbound address.
    pub to: Option<Vec<String>>,
    /// The subject line.
    pub subject: Option<String>,
    /// The plain-text body.
    pub text: Option<String>,
    /// The HTML body.
    pub html: Option<String>,
    /// A whole message (RFC 5322); when set, the other fields are ignored.
    pub raw: Option<String>,
    #[serde(flatten)]
    pub webhook_choice: crate::webhooks::WebhookChoiceInput,
}

fn refuse_without_sender_and_recipient() -> OperationError {
    OperationError::InvalidInput {
        message: "from and to are required".to_owned(),
        field: None,
    }
}

pub struct ReceiveInboundEmailOperation;

impl Operation for ReceiveInboundEmailOperation {
    type Input = EmailInboundRequest;
    type Output = NativeSendResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postEmailsInbound",
            method: HttpMethod::Post,
            path: "/api/v1/emails/inbound",
            summary: "Create an incoming email from fields or raw MIME; fires email.inbound.",
            cli_usage: "sendmock email inbound",
            mcp_tool: "sendmock_email_inbound",
            success_status: SuccessStatus::Created,
            cli_flag_names: &[("webhook_endpoint_ids", "webhook")],
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Stored as incoming mail and announced as `email.inbound` (EM-17.2).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailInboundRequest,
    ) -> Result<NativeSendResult, OperationError> {
        let operation_context = &input.webhook_choice.apply_to(operation_context).await?;
        let stored_email = match input.raw {
            Some(raw_message) => {
                let parsed_email = parse_email(raw_message.as_bytes());
                let recipients: Vec<String> = parsed_email
                    .to
                    .iter()
                    .chain(&parsed_email.cc)
                    .map(|recipient| recipient.address.clone())
                    .collect();
                if parsed_email.from.address.is_empty() || recipients.is_empty() {
                    return Err(refuse_without_sender_and_recipient());
                }
                let envelope = EmailEnvelope {
                    mail_from: parsed_email.from.address,
                    recipients,
                };
                store_inbound_raw_message(operation_context, raw_message.into_bytes(), envelope)
                    .await?
            }
            None => {
                let send_request = build_inbound_send_request(input)?;
                store_inbound_message(operation_context, &send_request).await?
            }
        };
        complete_email_intake(operation_context, &stored_email).await?;
        Ok(NativeSendResult {
            id: stored_email.email_id,
        })
    }
}

fn build_inbound_send_request(
    input: EmailInboundRequest,
) -> Result<NativeSendRequest, OperationError> {
    let from = input.from.unwrap_or_default();
    let to = input.to.unwrap_or_default();
    if from.trim().is_empty() || to.is_empty() {
        return Err(refuse_without_sender_and_recipient());
    }
    let has_body = input.text.is_some() || input.html.is_some();
    Ok(NativeSendRequest {
        from,
        to,
        cc: None,
        bcc: None,
        subject: input.subject.unwrap_or_else(|| "(no subject)".to_owned()),
        text: if has_body {
            input.text
        } else {
            Some(String::new())
        },
        html: input.html,
        headers: None,
        tags: None,
        attachments: None,
    })
}
