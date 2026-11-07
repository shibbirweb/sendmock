//! Meta's WhatsApp Business Cloud API (`graph.facebook.com/{version}/{phone_number_id}/...`),
//! served by the `whatsapp_cloud` provider (SM-18). Like Twilio's API it stays in code: a
//! message is an ordinary SendMock WhatsApp message with the API `whatsapp_cloud`.

use sendmock_sms::SendDecision;
use serde_json::{Value, json};

use super::created_message::CreatedMessage;
use super::message_provider_definition::MessageProviderDefinition;
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::provider_runtime::ProviderOutcome;
use super::request_checks::has_valid_credentials;
use super::twilio_answers::answer_json;
use super::whatsapp_cloud_content::{WhatsappContent, read_whatsapp_content};
use super::whatsapp_graph_errors::{
    UNDELIVERABLE_CODE, answer_graph_error, answer_invalid_parameter,
};
use super::whatsapp_read_receipts::answer_read_receipt;
use crate::sms::{
    IncomingSms, MediaProblem, accept_media, decide_outbound_send, start_sms_delivery, store_sms,
};
use crate::{OperationContext, OperationError, ProviderRoute};

pub const WHATSAPP_CLOUD_PROVIDER_KEY: &str = "whatsapp_cloud";
/// The business number messages are stored from when the provider names none.
const DEFAULT_BUSINESS_NUMBER: &str = "+15550783881";

/// What a request answered, and the message it stored, if any.
struct CloudAnswer {
    response: ProviderHttpResponse,
    created_message: Option<CreatedMessage>,
}

impl From<ProviderHttpResponse> for CloudAnswer {
    fn from(response: ProviderHttpResponse) -> Self {
        Self {
            response,
            created_message: None,
        }
    }
}

/// The phone number id of `/{version}/{phone_number_id}/messages`, where the version is
/// Graph's `v` and a number, such as `v21.0`.
fn read_messages_path(path: &str) -> Option<&str> {
    let mut segments = path.trim_start_matches('/').split('/');
    let (Some(version), Some(phone_number_id), Some("messages"), None) = (
        segments.next(),
        segments.next(),
        segments.next(),
        segments.next(),
    ) else {
        return None;
    };
    let is_graph_version = version.strip_prefix('v').is_some_and(|number| {
        !number.is_empty()
            && number
                .chars()
                .all(|character| character.is_ascii_digit() || character == '.')
    });
    (is_graph_version && !phone_number_id.is_empty()).then_some(phone_number_id)
}

fn read_credential<'provider>(
    provider: &'provider MessageProviderDefinition,
    credential_name: &str,
) -> Option<&'provider str> {
    provider
        .credentials
        .iter()
        .find(|credential| credential.name == credential_name)
        .map(|credential| credential.value.as_str())
        .filter(|value| !value.is_empty())
}

/// The Cloud API, served with the `whatsapp_cloud` provider while it is routable.
pub async fn answer_whatsapp_cloud(
    operation_context: &OperationContext,
    providers: &[MessageProviderDefinition],
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    let is_cloud_route = matches!(
        provider_route,
        ProviderRoute::Prefixed(WHATSAPP_CLOUD_PROVIDER_KEY) | ProviderRoute::ProviderPort
    );
    let Some(cloud_provider) = providers
        .iter()
        .find(|provider| provider.key == WHATSAPP_CLOUD_PROVIDER_KEY && provider.is_routable())
        .filter(|_| is_cloud_route)
    else {
        return Ok(None);
    };
    let Some(phone_number_id) = read_messages_path(&request.path) else {
        return Ok(None);
    };
    if request.method != "POST" {
        return Ok(None);
    }
    let cloud_answer = if has_valid_credentials(cloud_provider, request) {
        answer_messages_request(operation_context, cloud_provider, phone_number_id, request).await?
    } else {
        answer_graph_error(
            operation_context,
            401,
            190,
            "Invalid OAuth access token - Cannot parse access token",
            "Invalid OAuth access token",
        )
        .into()
    };
    Ok(Some(ProviderOutcome {
        response: cloud_answer.response,
        provider_key: Some(WHATSAPP_CLOUD_PROVIDER_KEY.to_owned()),
        created_message: cloud_answer.created_message,
        secret_values: cloud_provider
            .credentials
            .iter()
            .filter(|credential| credential.is_secret)
            .map(|credential| credential.value.clone())
            .collect(),
    }))
}

/// A send, or a read receipt when the body says `status: "read"`.
async fn answer_messages_request(
    operation_context: &OperationContext,
    cloud_provider: &MessageProviderDefinition,
    phone_number_id: &str,
    request: &ProviderHttpRequest,
) -> Result<CloudAnswer, OperationError> {
    let Ok(message) = serde_json::from_slice::<Value>(&request.body) else {
        return Ok(answer_invalid_parameter(
            operation_context,
            "The request body is not valid JSON.",
        )
        .into());
    };
    match message["messaging_product"].as_str() {
        Some("whatsapp") => {}
        None => {
            let reason = "The parameter messaging_product is required.";
            return Ok(answer_invalid_parameter(operation_context, reason).into());
        }
        Some(_) => {
            let reason = "Param messaging_product must be 'whatsapp'.";
            return Ok(answer_invalid_parameter(operation_context, reason).into());
        }
    }
    if message["status"].as_str() == Some("read") {
        return Ok(answer_read_receipt(operation_context, &message)
            .await?
            .into());
    }
    let sender = CloudSender {
        business_number: read_credential(cloud_provider, "phone_number")
            .unwrap_or(DEFAULT_BUSINESS_NUMBER)
            .to_owned(),
        phone_number_id: phone_number_id.to_owned(),
    };
    answer_send(operation_context, &sender, &message).await
}

/// Who sends: the business number the messages are stored from, and the path's id.
struct CloudSender {
    business_number: String,
    phone_number_id: String,
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
async fn answer_send(
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
) -> Result<Option<sendmock_store::SmsRecord>, OperationError> {
    let media = match accept_media(operation_context, &[], &content.media_links).await {
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
