use schemars::JsonSchema;
use sendmock_core::format_rfc5322;
use sendmock_mail::{NativeMessage, build_raw_message};
use serde::{Deserialize, Serialize};

use super::sample_email_sender::SampleEmail;
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, SuccessStatus,
};

const SAMPLE_SENDER: &str = "SendMock <sample@sendmock.local>";
const SAMPLE_SENDER_ADDRESS: &str = "sample@sendmock.local";

#[derive(Debug, Deserialize, JsonSchema)]
pub struct SampleRequest {
    /// What to create: `email`, `sms`, `verification` or `http`.
    pub kind: String,
    /// The recipient of the sample email.
    pub to: Option<String>,
    /// The subject of the sample email.
    pub subject: Option<String>,
    /// The HTML body of the sample email.
    pub html: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct CreatedSample {
    pub kind: String,
    /// Email or SMS ID, or the verification SID.
    pub id: String,
}

pub struct CreateSampleOperation;

impl Operation for CreateSampleOperation {
    type Input = SampleRequest;
    type Output = CreatedSample;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSamplesByKind",
            method: HttpMethod::Post,
            path: "/api/v1/samples/{kind}",
            summary: "Create a sample email, SMS, verification or HTTP request through the normal path.",
            cli_usage: "sendmock sample <kind>",
            mcp_tool: "sendmock_sample_send",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// An email goes over SMTP to SendMock itself; the other kinds come with their phases.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SampleRequest,
    ) -> Result<CreatedSample, OperationError> {
        if input.kind != "email" {
            return Err(OperationError::NotFound {
                message: format!(
                    "Samples of kind {} are not available in this version yet",
                    input.kind
                ),
            });
        }
        let sample_email = build_sample_email(operation_context, &input);
        let sample_email_sender =
            operation_context
                .sample_email_sender
                .as_ref()
                .ok_or_else(|| {
                    OperationError::Internal("The SMTP listener is not running".to_owned())
                })?;
        let email_id = sample_email_sender
            .send_sample_email(sample_email)
            .await
            .map_err(|send_problem| {
                OperationError::Internal(format!(
                    "Could not send the sample over SMTP: {send_problem}"
                ))
            })?;
        Ok(CreatedSample {
            kind: input.kind,
            id: email_id,
        })
    }
}

fn build_sample_email(operation_context: &OperationContext, input: &SampleRequest) -> SampleEmail {
    let recipient = input
        .to
        .clone()
        .unwrap_or_else(|| "user@example.test".to_owned());
    let native_message = NativeMessage {
        from: SAMPLE_SENDER.to_owned(),
        to: vec![recipient.clone()],
        cc: Vec::new(),
        subject: input
            .subject
            .clone()
            .unwrap_or_else(|| "Hello from SendMock".to_owned()),
        text: Some("It works! This sample came in over SMTP. Your code is 482913.".to_owned()),
        html: Some(
            input
                .html
                .clone()
                .unwrap_or_else(|| "<p>It works! Your code is <b>482913</b>.</p>".to_owned()),
        ),
        headers: Vec::new(),
        attachments: Vec::new(),
    };
    let message_id = format!(
        "{}@sendmock.local",
        operation_context.id_generator.generate_id()
    );
    SampleEmail {
        mail_from: SAMPLE_SENDER_ADDRESS.to_owned(),
        recipient,
        raw_message: build_raw_message(
            &native_message,
            &message_id,
            &format_rfc5322(operation_context.clock.now_unix_ms()),
        ),
    }
}
