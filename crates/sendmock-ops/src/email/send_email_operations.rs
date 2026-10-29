use sendmock_core::format_rfc5322;
use sendmock_mail::{EmailEnvelope, IncomingEmail, build_raw_message, parse_email};

use super::email_inputs::RawMessageInput;
use super::lookups::NativeSendResult;
use super::native_send_request::{NativeSendRequest, read_bare_address};
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, RawBodyInput,
    RequestLogSettings, SuccessStatus, publish_email_received, read_ingest_options,
};

/// Native sends appear in the API request log, linked to the email they created.
const NATIVE_EMAIL_REQUEST_LOG: RequestLogSettings = RequestLogSettings {
    api: "native",
    linked_message_kind: Some("email"),
};

pub struct SendEmailOperation;

impl Operation for SendEmailOperation {
    type Input = NativeSendRequest;
    type Output = NativeSendResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSend",
            method: HttpMethod::Post,
            path: "/api/v1/send",
            summary: "Native send: JSON with optional base64 attachments.",
            cli_usage: "sendmock email send",
            mcp_tool: "sendmock_email_send",
            success_status: SuccessStatus::Created,
            request_log: Some(NATIVE_EMAIL_REQUEST_LOG),
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Builds the message SMTP would have carried and stores it through the same path.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: NativeSendRequest,
    ) -> Result<NativeSendResult, OperationError> {
        let native_message = input.to_native_message()?;
        let message_id = format!(
            "{}@sendmock.local",
            operation_context.id_generator.generate_id()
        );
        let raw_message = build_raw_message(
            &native_message,
            &message_id,
            &format_rfc5322(operation_context.clock.now_unix_ms()),
        );
        let envelope = EmailEnvelope {
            mail_from: read_bare_address(&input.from),
            recipients: input.envelope_recipients(),
        };
        let mut incoming_email = IncomingEmail::sent_by_app(raw_message, envelope, "native_api");
        incoming_email.extra_tags = input.tags.clone().unwrap_or_default();
        let stored_email = operation_context
            .email_ingest_service
            .ingest(
                incoming_email,
                &read_ingest_options(operation_context).await?,
            )
            .await
            .map_err(|mail_error| OperationError::Internal(mail_error.to_string()))?;
        publish_email_received(operation_context, &stored_email);
        Ok(NativeSendResult {
            id: stored_email.email_id,
        })
    }
}

pub struct SendRawEmailOperation;

impl Operation for SendRawEmailOperation {
    type Input = RawMessageInput;
    type Output = NativeSendResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSendRaw",
            method: HttpMethod::Post,
            path: "/api/v1/send/raw",
            summary: "Store a raw message as sent by your app, as the sendmail shim does.",
            cli_usage: "sendmock sendmail",
            mcp_tool: "sendmock_email_send_raw",
            success_status: SuccessStatus::Created,
            raw_body_input: Some(RawBodyInput {
                input_name: "raw_message",
                content_type: "message/rfc822",
            }),
            request_log: Some(NATIVE_EMAIL_REQUEST_LOG),
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The envelope comes from the message's own From, To and Cc, as `sendmail -t` reads them.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: RawMessageInput,
    ) -> Result<NativeSendResult, OperationError> {
        if input.raw_message.trim().is_empty() {
            return Err(OperationError::InvalidInput {
                message: "The message is empty".to_owned(),
                field: Some("raw_message".to_owned()),
            });
        }
        let raw_message = input.raw_message.into_bytes();
        let parsed_email = parse_email(&raw_message);
        let envelope = EmailEnvelope {
            mail_from: parsed_email.from.address.clone(),
            recipients: parsed_email
                .to
                .iter()
                .chain(&parsed_email.cc)
                .map(|recipient| recipient.address.clone())
                .collect(),
        };
        let stored_email = operation_context
            .email_ingest_service
            .ingest(
                IncomingEmail::sent_by_app(raw_message, envelope, "sendmail"),
                &read_ingest_options(operation_context).await?,
            )
            .await
            .map_err(|mail_error| OperationError::Internal(mail_error.to_string()))?;
        publish_email_received(operation_context, &stored_email);
        Ok(NativeSendResult {
            id: stored_email.email_id,
        })
    }
}
