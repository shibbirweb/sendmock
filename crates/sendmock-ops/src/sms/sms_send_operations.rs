use sendmock_sms::SendDecision;

use super::message_sid::generate_message_sid;
use super::sms_delivery_runner::start_sms_delivery;
use super::sms_detail::{SmsMessageDetail, load_sms_detail};
use super::sms_ingest::{IncomingSms, store_sms};
use super::sms_inputs::{InboundSmsRequest, InlineSmsMedia, NativeSmsRequest};
use super::sms_media_intake::{AcceptedMedia, MediaProblem, accept_media};
use super::sms_send_decision::{decide_outbound_send, describe_rejection};
use crate::sms_replies::start_reply_webhook;
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

/// An inbound message's files: a problem with them fails the request, as nothing was stored yet.
async fn accept_inbound_media(
    operation_context: &OperationContext,
    inline_media: &[InlineSmsMedia],
) -> Result<AcceptedMedia, OperationError> {
    match accept_media(operation_context, inline_media, &[]).await {
        Ok(accepted_media) => Ok(accepted_media),
        Err(MediaProblem::Invalid(operation_error)) => Err(operation_error),
        Err(MediaProblem::Unfetchable(reason)) => Err(OperationError::Internal(reason)),
    }
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

    /// Refuses magic and custom reject numbers before storing anything, then stores the message
    /// as `queued` and starts its delivery simulation. A link that cannot be fetched stores it
    /// `failed` with Twilio's `11200`, as Twilio does.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: NativeSmsRequest,
    ) -> Result<SmsMessageDetail, OperationError> {
        require_text("to", &input.to)?;
        require_text("body", &input.body)?;
        require_text("from", &input.from)?;
        let delivery_steps =
            match decide_outbound_send(operation_context, &input.to, &input.from).await? {
                SendDecision::Rejected { error_code, reason } => {
                    return Err(describe_rejection(&error_code, &reason));
                }
                SendDecision::Accepted(delivery_steps) => delivery_steps,
            };
        let sms = store_sms(
            operation_context,
            build_native_sms(operation_context, input).await?,
        )
        .await?;
        let sms = if sms.status == "queued" {
            start_sms_delivery(operation_context, sms, delivery_steps).await?
        } else {
            sms
        };
        load_sms_detail(operation_context, sms).await
    }
}

/// The message as the native API received it; a media link that cannot be fetched makes it
/// `failed` with `11200`.
async fn build_native_sms(
    operation_context: &OperationContext,
    input: NativeSmsRequest,
) -> Result<IncomingSms, OperationError> {
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
    Ok(IncomingSms {
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
        in_reply_to_sms_id: None,
        provider_id: None,
        media,
    })
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
            cli_flag_names: &[("webhook_endpoint_ids", "webhook")],
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Stores it as `received` with a Twilio-style `SM` SID, publishes `sms.inbound` and sends
    /// it to the number's reply webhook in the background.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: InboundSmsRequest,
    ) -> Result<SmsMessageDetail, OperationError> {
        let operation_context = &input.webhook_choice.apply_to(operation_context).await?;
        require_text("from", &input.from)?;
        require_text("to", &input.to)?;
        let media = accept_inbound_media(
            operation_context,
            input.media.as_deref().unwrap_or_default(),
        )
        .await?;
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
                in_reply_to_sms_id: None,
                provider_id: Some(generate_message_sid(operation_context)),
                media,
            },
        )
        .await?;
        start_reply_webhook(operation_context, sms.clone(), input.template_id);
        load_sms_detail(operation_context, sms).await
    }
}
