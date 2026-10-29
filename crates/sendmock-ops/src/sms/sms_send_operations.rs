use super::sms_detail::{SmsMessageDetail, load_sms_detail};
use super::sms_ingest::{IncomingSms, store_sms};
use super::sms_inputs::{InboundSmsRequest, NativeSmsRequest};
use super::sms_media_intake::{MediaProblem, accept_media};
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
    RequestLogSettings, SuccessStatus,
};

/// Native sends appear in the API request log, linked to the SMS they created.
const NATIVE_SMS_REQUEST_LOG: RequestLogSettings = RequestLogSettings {
    api: "native",
    linked_message_kind: Some("sms"),
};

fn require_text(field_name: &str, field_value: &str) -> Result<(), OperationError> {
    if field_value.trim().is_empty() {
        return Err(OperationError::InvalidInput {
            message: format!("{field_name} is required"),
            field: Some(field_name.to_owned()),
        });
    }
    Ok(())
}

pub struct SendSmsOperation;

impl Operation for SendSmsOperation {
    type Input = NativeSmsRequest;
    type Output = SmsMessageDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSms",
            method: HttpMethod::Post,
            path: "/api/v1/sms",
            summary: "Native send, with optional media URLs or inline media.",
            cli_usage: "sendmock sms send",
            mcp_tool: "sendmock_sms_send",
            success_status: SuccessStatus::Created,
            request_log: Some(NATIVE_SMS_REQUEST_LOG),
            get_alias_path: Some("/api/v1/sms/send"),
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Stores the message as `queued`; a link that cannot be fetched stores it `failed` with
    /// Twilio's `11200`, as Twilio does.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: NativeSmsRequest,
    ) -> Result<SmsMessageDetail, OperationError> {
        require_text("to", &input.to)?;
        require_text("body", &input.body)?;
        require_text("from", &input.from)?;
        let request_body_json = serde_json::to_string(&serde_json::json!({
            "from": input.from, "to": input.to, "body": input.body,
            "status_callback": input.status_callback, "media_urls": input.media_urls,
        }))
        .ok();
        let (media, status, error_code) = match accept_media(
            operation_context,
            input.media.as_deref().unwrap_or_default(),
            input.media_urls.as_deref().unwrap_or_default(),
        )
        .await
        {
            Ok(accepted_media) => (accepted_media, "queued", None),
            Err(MediaProblem::Invalid(operation_error)) => return Err(operation_error),
            Err(MediaProblem::Unfetchable { .. }) => {
                (Default::default(), "failed", Some("11200".to_owned()))
            }
        };
        let sms = store_sms(
            operation_context,
            IncomingSms {
                is_inbound: false,
                api: "native".to_owned(),
                from: input.from,
                to: input.to,
                body: input.body,
                status: status.to_owned(),
                error_code,
                status_callback_url: input.status_callback.filter(|url| !url.trim().is_empty()),
                messaging_service_sid: None,
                account: None,
                metadata_json: input
                    .metadata
                    .map(|metadata| serde_json::Value::Object(metadata).to_string()),
                request_body_json,
                provider_id: None,
                media,
            },
        )
        .await?;
        load_sms_detail(operation_context, sms).await
    }
}

pub struct SimulateInboundSmsOperation;

impl Operation for SimulateInboundSmsOperation {
    type Input = InboundSmsRequest;
    type Output = SmsMessageDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postSmsInbound",
            method: HttpMethod::Post,
            path: "/api/v1/sms/inbound",
            summary: "Simulate a message from a contact to one of your numbers.",
            cli_usage: "sendmock sms inbound",
            mcp_tool: "sendmock_sms_simulate_inbound",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Stores it as `received` and publishes `sms.inbound`; the reply webhook comes in Phase 3.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: InboundSmsRequest,
    ) -> Result<SmsMessageDetail, OperationError> {
        require_text("from", &input.from)?;
        require_text("to", &input.to)?;
        let media = match accept_media(
            operation_context,
            input.media.as_deref().unwrap_or_default(),
            &[],
        )
        .await
        {
            Ok(accepted_media) => accepted_media,
            Err(MediaProblem::Invalid(operation_error)) => return Err(operation_error),
            Err(MediaProblem::Unfetchable(reason)) => {
                return Err(OperationError::Internal(reason));
            }
        };
        let is_whatsapp = input.channel.as_deref() == Some("whatsapp");
        let with_channel = |number: &str| {
            if is_whatsapp && !number.starts_with("whatsapp:") {
                format!("whatsapp:{number}")
            } else {
                number.to_owned()
            }
        };
        let sms = store_sms(
            operation_context,
            IncomingSms {
                is_inbound: true,
                api: "native".to_owned(),
                from: with_channel(&input.from),
                to: with_channel(&input.to),
                body: input.body,
                status: "received".to_owned(),
                error_code: None,
                status_callback_url: None,
                messaging_service_sid: None,
                account: None,
                metadata_json: None,
                request_body_json: Some(
                    serde_json::json!({ "template_id": input.template_id }).to_string(),
                ),
                provider_id: None,
                media,
            },
        )
        .await?;
        load_sms_detail(operation_context, sms).await
    }
}
