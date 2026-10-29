use sendmock_sms::{SendDecision, describe_error_code, outcome_name_for_error_code};
use sendmock_store::SmsRecord;

use super::provider_call::{ProviderCall, describe_message};
use super::provider_http::ProviderHttpResponse;
use super::request_checks::{ProviderFailure, find_rule_failure};
use crate::sms::{
    IncomingSms, MediaProblem, accept_media, decide_outbound_send, start_sms_delivery, store_sms,
};
use crate::{OperationContext, OperationError};

/// Twilio's code for a media link that cannot be fetched; the message is stored `failed`.
const MEDIA_UNFETCHABLE_ERROR_CODE: &str = "11200";

/// What a provider request got, and the SMS it created, for the request log.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderAnswer {
    pub response: ProviderHttpResponse,
    pub created_sms_id: Option<String>,
}

impl ProviderAnswer {
    pub fn without_message(response: ProviderHttpResponse) -> Self {
        Self {
            response,
            created_sms_id: None,
        }
    }
}

/// The message parts a send reads.
struct SendParts {
    to: String,
    from: String,
    body: String,
    media_urls: Vec<String>,
    status_callback_url: Option<String>,
    messaging_service_sid: Option<String>,
}

/// Stores one message as the provider's API received it and answers in the provider's shape:
/// the definition's checks first, then a sender and a text, then the magic and custom outcome
/// numbers with the provider's error codes. The answer shows the message as `queued`, before
/// the delivery simulation moves it on.
pub async fn answer_send(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
) -> Result<ProviderAnswer, OperationError> {
    let send_parts = match read_send_parts(provider_call) {
        Ok(send_parts) => send_parts,
        Err(failure) => {
            return Ok(ProviderAnswer::without_message(
                provider_call.render_failure(&failure),
            ));
        }
    };
    let delivery_steps =
        match decide_outbound_send(operation_context, &send_parts.to, &send_parts.from).await? {
            SendDecision::Accepted(delivery_steps) => delivery_steps,
            SendDecision::Rejected { error_code, reason } => {
                let failure = describe_rejection(provider_call, &error_code, &reason);
                return Ok(ProviderAnswer::without_message(
                    provider_call.render_failure(&failure),
                ));
            }
        };
    let sms = store_provider_sms(operation_context, provider_call, send_parts).await?;
    let response = provider_call.render_success(&describe_message(provider_call.provider, &sms));
    let created_sms_id = Some(sms.sms_id.clone());
    if sms.status == "queued" {
        start_sms_delivery(operation_context, sms, delivery_steps).await?;
    }
    Ok(ProviderAnswer {
        response,
        created_sms_id,
    })
}

fn read_send_parts(provider_call: &ProviderCall<'_>) -> Result<SendParts, ProviderFailure> {
    let part_values = provider_call.read_part_values();
    if let Some(failure) = find_rule_failure(provider_call.provider, &part_values) {
        return Err(failure);
    }
    let first_value = |part: &str| {
        part_values
            .get(part)
            .and_then(|values| values.first())
            .cloned()
    };
    let send_parts = SendParts {
        to: first_value("to").unwrap_or_default(),
        from: first_value("from").unwrap_or_default(),
        body: first_value("body").unwrap_or_default(),
        media_urls: part_values.get("media_urls").cloned().unwrap_or_default(),
        status_callback_url: first_value("status_callback_url"),
        messaging_service_sid: first_value("messaging_service"),
    };
    if send_parts.to.is_empty() {
        return Err(missing_part(provider_call, "to", None));
    }
    if send_parts.from.is_empty() {
        return Err(missing_part(
            provider_call,
            "from",
            Some("A 'From' phone number is required."),
        ));
    }
    if send_parts.body.is_empty() && send_parts.media_urls.is_empty() {
        return Err(missing_part(
            provider_call,
            "body",
            Some("Message body is required."),
        ));
    }
    Ok(send_parts)
}

fn missing_part(
    provider_call: &ProviderCall<'_>,
    part: &str,
    provider_message: Option<&str>,
) -> ProviderFailure {
    ProviderFailure {
        code: provider_call
            .provider
            .outcome_error_codes
            .get(&format!("missing_{part}"))
            .cloned(),
        provider_message: provider_message.map(str::to_owned),
        ..ProviderFailure::new("missing_field", part, format!("{part} is required"))
    }
}

/// A refused send in the provider's terms: its own code for the outcome when it maps one.
fn describe_rejection(
    provider_call: &ProviderCall<'_>,
    error_code: &str,
    reason: &str,
) -> ProviderFailure {
    let provider_code = outcome_name_for_error_code(error_code)
        .and_then(|outcome_name| provider_call.provider.outcome_error_codes.get(outcome_name))
        .cloned()
        .unwrap_or_else(|| error_code.to_owned());
    let provider_message = describe_error_code(error_code)
        .map_or_else(|| format!("Rejected by {reason}"), str::to_owned);
    ProviderFailure {
        code: Some(provider_code),
        provider_message: Some(provider_message),
        ..ProviderFailure::new(
            "invalid_value",
            "to",
            format!("Rejected with error {error_code} ({reason})"),
        )
    }
}

async fn store_provider_sms(
    operation_context: &OperationContext,
    provider_call: &ProviderCall<'_>,
    send_parts: SendParts,
) -> Result<SmsRecord, OperationError> {
    let (media, status, error_code) =
        match accept_media(operation_context, &[], &send_parts.media_urls).await {
            Ok(accepted_media) => (accepted_media, "queued", None),
            Err(MediaProblem::Invalid(operation_error)) => return Err(operation_error),
            Err(MediaProblem::Unfetchable(_)) => (
                Default::default(),
                "failed",
                Some(MEDIA_UNFETCHABLE_ERROR_CODE.to_owned()),
            ),
        };
    let provider_id = sendmock_core::render_template(
        &provider_call.provider.message_id_template,
        &serde_json::json!({}),
        provider_call.template_functions,
        sendmock_core::TemplateEscape::None,
    )
    .text;
    store_sms(
        operation_context,
        IncomingSms {
            is_inbound: false,
            api: provider_call.provider.key.clone(),
            from: send_parts.from,
            to: send_parts.to,
            body: send_parts.body,
            status: status.to_owned(),
            error_code,
            status_callback_url: send_parts.status_callback_url,
            messaging_service_sid: send_parts.messaging_service_sid,
            account: provider_call.path_params.get("AccountSid").cloned(),
            metadata_json: None,
            request_body_json: Some(provider_call.describe_request_without_secrets()),
            provider_id: Some(provider_id).filter(|provider_id| !provider_id.is_empty()),
            media,
        },
    )
    .await
}
