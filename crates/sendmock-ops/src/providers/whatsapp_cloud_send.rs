//! A Cloud API send: the message stored as a WhatsApp message and Meta's answer.

use sendmock_sms::SendDecision;
use sendmock_store::SmsRecord;
use serde_json::{Value, json};

use super::created_message::CreatedMessage;
use super::twilio_answers::answer_json;
use super::whatsapp_cloud_api::{CloudAnswer, WHATSAPP_CLOUD_PROVIDER_KEY};
use super::whatsapp_cloud_content::{WhatsappContent, read_whatsapp_content};
use super::whatsapp_cloud_media::load_media_by_ids;
use super::whatsapp_graph_errors::{
    UNDELIVERABLE_CODE, answer_graph_error, answer_invalid_parameter,
};
use crate::sms::{
    IncomingSms, MediaProblem, accept_media, decide_outbound_send, start_sms_delivery, store_sms,
};
use crate::{OperationContext, OperationError};

/// Who sends: the business number the messages are stored from, and the path's id.
pub(super) struct CloudSender {
    pub(super) business_number: String,
    pub(super) phone_number_id: String,
}

/// Meta's numbers have no `+`; SendMock stores E.164.
fn to_e164(phone_number: &str) -> String {
    format!("+{}", phone_number.trim().trim_start_matches('+'))
}

fn generate_wamid(operation_context: &OperationContext) -> String {
    let random_source = &operation_context.random_source;
    format!(
        "wamid.HBgL{:016X}{:016X}{:016X}",
        random_source.next_u64(),
        random_source.next_u64(),
        random_source.next_u64()
    )
}

/// Meta's answer to an accepted send: who it went to and the message id.
fn build_sent_answer(message: &Value, recipient: &str, to_number: &str, wamid: &str) -> Value {
    let mut sent_message = json!({ "id": wamid });
    if message["type"].as_str() == Some("template") {
        sent_message["message_status"] = json!("accepted");
    }
    json!({
        "messaging_product": "whatsapp",
        "contacts": [{ "input": recipient, "wa_id": to_number.trim_start_matches('+') }],
        "messages": [sent_message],
    })
}

/// A magic or custom outcome number refused: the Cloud API's undeliverable error.
fn answer_undeliverable(operation_context: &OperationContext, reason: &str) -> CloudAnswer {
    let message = "Message undeliverable.";
    answer_graph_error(operation_context, 400, UNDELIVERABLE_CODE, message, reason).into()
}

/// Stores the message and answers Meta's `contacts` and `messages`, or Graph's refusal.
pub(super) async fn answer_send(
    operation_context: &OperationContext,
    sender: &CloudSender,
    message: &Value,
) -> Result<CloudAnswer, OperationError> {
    let Some(recipient) = message["to"]
        .as_str()
        .filter(|recipient| !recipient.trim().is_empty())
    else {
        let reason = "The parameter to is required.";
        return Ok(answer_invalid_parameter(operation_context, reason).into());
    };
    let content = match read_whatsapp_content(message) {
        Ok(content) => content,
        Err(reason) => return Ok(answer_invalid_parameter(operation_context, &reason).into()),
    };
    let to_number = to_e164(recipient);
    let decision = decide_outbound_send(operation_context, &to_number, &sender.business_number);
    let delivery_steps = match decision.await? {
        SendDecision::Accepted(delivery_steps) => delivery_steps,
        SendDecision::Rejected { reason, .. } => {
            return Ok(answer_undeliverable(operation_context, &reason));
        }
    };
    let wamid = generate_wamid(operation_context);
    let stored_message = CloudMessage {
        message,
        to_number: &to_number,
        wamid: &wamid,
    };
    let Some(sms) =
        store_cloud_message(operation_context, sender, &stored_message, content).await?
    else {
        let reason = "The media link could not be downloaded.";
        let refusal = answer_graph_error(
            operation_context,
            400,
            131_053,
            "Media upload error",
            reason,
        );
        return Ok(refusal.into());
    };
    let response = answer_json(
        200,
        build_sent_answer(message, recipient, &to_number, &wamid),
    );
    let created_message = Some(CreatedMessage::sms(sms.sms_id.clone()));
    start_sms_delivery(operation_context, sms, delivery_steps).await?;
    Ok(CloudAnswer {
        response,
        created_message,
    })
}

/// The request and the ids the stored message carries.
struct CloudMessage<'request> {
    message: &'request Value,
    to_number: &'request str,
    wamid: &'request str,
}

/// The message as SendMock stores it; `None` when a media link cannot be downloaded.
async fn store_cloud_message(
    operation_context: &OperationContext,
    sender: &CloudSender,
    cloud_message: &CloudMessage<'_>,
    content: WhatsappContent,
) -> Result<Option<SmsRecord>, OperationError> {
    let uploaded_media = load_media_by_ids(operation_context, &content.media_ids).await?;
    let media = match accept_media(operation_context, &uploaded_media, &content.media_links).await {
        Ok(accepted_media) => accepted_media,
        Err(MediaProblem::Invalid(operation_error)) => return Err(operation_error),
        Err(MediaProblem::Unfetchable(_)) => return Ok(None),
    };
    let incoming_sms = IncomingSms {
        is_inbound: false,
        api: WHATSAPP_CLOUD_PROVIDER_KEY.to_owned(),
        from: format!("whatsapp:{}", sender.business_number),
        to: format!("whatsapp:{}", cloud_message.to_number),
        body: content.body,
        status: "queued".to_owned(),
        error_code: None,
        status_callback_url: None,
        messaging_service_sid: None,
        account: None,
        metadata_json: Some(json!({ "phone_number_id": sender.phone_number_id }).to_string()),
        request_body_json: Some(cloud_message.message.to_string()),
        in_reply_to_sms_id: None,
        provider_id: Some(cloud_message.wamid.to_owned()),
        media,
    };
    Ok(Some(store_sms(operation_context, incoming_sms).await?))
}
