use sendmock_sms::{SendDecision, TwimlMessage, resolve_twiml_url};
use sendmock_store::SmsRecord;

use crate::providers::load_sms_provider_definitions;
use crate::sms::{
    AcceptedMedia, IncomingSms, MediaProblem, accept_media, decide_outbound_send,
    generate_message_sid, start_sms_delivery, store_sms,
};
use crate::{OperationContext, OperationError};

/// Twilio's code for a media link that cannot be fetched; the reply is stored `failed`.
const MEDIA_UNFETCHABLE_ERROR_CODE: &str = "11200";

/// What a `<Message>` says, read against the conversation it answers.
pub struct TwimlReplyRequest<'reply> {
    pub inbound_sms: &'reply SmsRecord,
    pub twiml_message: &'reply TwimlMessage,
    /// The URL whose TwiML held the verb; relative URLs in it resolve against this.
    pub document_url: &'reply str,
    pub messaging_service_sid: Option<&'reply str>,
}

impl TwimlReplyRequest<'_> {
    /// `from` and `to`: back to the sender from the number that was texted, unless the verb
    /// says otherwise; WhatsApp conversations keep their `whatsapp:` prefix.
    fn resolve_numbers(&self) -> (String, String) {
        let channel_prefix = if self.inbound_sms.channel == "whatsapp" {
            "whatsapp:"
        } else {
            ""
        };
        let from = self
            .twiml_message
            .from
            .clone()
            .unwrap_or_else(|| format!("{channel_prefix}{}", self.inbound_sms.to_number));
        let to = self
            .twiml_message
            .to
            .clone()
            .unwrap_or_else(|| format!("{channel_prefix}{}", self.inbound_sms.from_number));
        (from, to)
    }

    fn resolve_url(&self, twiml_url: &str) -> String {
        resolve_twiml_url(self.document_url, twiml_url)
    }
}

/// Stores a `<Message>` as an outbound Twilio message in the same thread, linked to the
/// inbound message, and starts its delivery like any sent message. A number the outcome rules
/// refuse, or media that cannot be fetched, stores it `failed` with the error code, as Twilio
/// reports a TwiML reply it could not send.
pub async fn send_twiml_reply(
    operation_context: &OperationContext,
    reply_request: &TwimlReplyRequest<'_>,
) -> Result<SmsRecord, OperationError> {
    let twiml_message = reply_request.twiml_message;
    let (from, to) = reply_request.resolve_numbers();
    let (delivery_steps, refusal) =
        match decide_outbound_send(operation_context, &to, &from).await? {
            SendDecision::Accepted(delivery_steps) => (delivery_steps, None),
            SendDecision::Rejected { error_code, .. } => (Vec::new(), Some(error_code)),
        };
    let (media, media_refusal) = accept_reply_media(operation_context, reply_request).await?;
    let error_code = refusal.or(media_refusal);
    let sms = store_sms(
        operation_context,
        IncomingSms {
            is_inbound: false,
            api: "twilio".to_owned(),
            from,
            to,
            body: twiml_message.body.clone(),
            status: if error_code.is_some() {
                "failed"
            } else {
                "queued"
            }
            .to_owned(),
            error_code,
            status_callback_url: twiml_message
                .status_callback
                .as_deref()
                .map(|callback_url| reply_request.resolve_url(callback_url)),
            messaging_service_sid: reply_request.messaging_service_sid.map(str::to_owned),
            account: find_twilio_account_sid(operation_context).await?,
            metadata_json: None,
            request_body_json: Some(describe_twiml_message(twiml_message)),
            provider_id: Some(generate_message_sid(operation_context)),
            in_reply_to_sms_id: Some(reply_request.inbound_sms.sms_id.clone()),
            media,
        },
    )
    .await?;
    if sms.status == "queued" {
        return start_sms_delivery(operation_context, sms, delivery_steps).await;
    }
    Ok(sms)
}

/// The `<Media>` files, downloaded like Twilio's `MediaUrl`; one that cannot be fetched gives
/// `11200` and no media.
async fn accept_reply_media(
    operation_context: &OperationContext,
    reply_request: &TwimlReplyRequest<'_>,
) -> Result<(AcceptedMedia, Option<String>), OperationError> {
    let media_urls: Vec<String> = reply_request
        .twiml_message
        .media_urls
        .iter()
        .map(|media_url| reply_request.resolve_url(media_url))
        .collect();
    match accept_media(operation_context, &[], &media_urls).await {
        Ok(accepted_media) => Ok((accepted_media, None)),
        Err(MediaProblem::Invalid(operation_error)) => Err(operation_error),
        Err(MediaProblem::Unfetchable(_)) => Ok((
            AcceptedMedia::default(),
            Some(MEDIA_UNFETCHABLE_ERROR_CODE.to_owned()),
        )),
    }
}

async fn find_twilio_account_sid(
    operation_context: &OperationContext,
) -> Result<Option<String>, OperationError> {
    let providers = load_sms_provider_definitions(operation_context).await?;
    Ok(providers
        .iter()
        .find(|provider| provider.key == "twilio")
        .and_then(|provider| {
            provider
                .credentials
                .iter()
                .find(|credential| credential.name == "account_sid")
        })
        .map(|credential| credential.value.clone()))
}

/// The verb as the message detail's request shows it.
fn describe_twiml_message(twiml_message: &TwimlMessage) -> String {
    serde_json::json!({
        "verb": "Message",
        "body": twiml_message.body,
        "to": twiml_message.to,
        "from": twiml_message.from,
        "status_callback": twiml_message.status_callback,
        "action": twiml_message.action,
        "method": twiml_message.method.as_str(),
        "media_urls": twiml_message.media_urls,
    })
    .to_string()
}
