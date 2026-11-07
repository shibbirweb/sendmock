//! Meta's WhatsApp Business Cloud API (`graph.facebook.com/{version}/{phone_number_id}/...`),
//! served by the `whatsapp_cloud` provider (SM-18). Like Twilio's API it stays in code: a
//! message is an ordinary SendMock WhatsApp message with the API `whatsapp_cloud`.

use serde_json::Value;

use super::created_message::CreatedMessage;
use super::message_provider_definition::MessageProviderDefinition;
use super::provider_http::{ProviderHttpRequest, ProviderHttpResponse};
use super::provider_runtime::ProviderOutcome;
use super::request_checks::has_valid_credentials;
use super::whatsapp_cloud_media::{answer_media_delete, answer_media_lookup, answer_media_upload};
use super::whatsapp_cloud_paths::{CloudPath, read_cloud_path};
use super::whatsapp_cloud_send::{CloudSender, answer_send};
use super::whatsapp_graph_errors::{answer_graph_error, answer_invalid_parameter};
use super::whatsapp_read_receipts::answer_read_receipt;
use crate::{OperationContext, OperationError, ProviderRoute};

pub const WHATSAPP_CLOUD_PROVIDER_KEY: &str = "whatsapp_cloud";
/// Meta's webhook envelope, for statuses and replies alike.
pub const WHATSAPP_CLOUD_TEMPLATE_ID: &str = "whatsapp.cloud";
/// The business number messages are stored from when the provider names none.
const DEFAULT_BUSINESS_NUMBER: &str = "+15550783881";

/// What a request answered, and the message it stored, if any.
pub(super) struct CloudAnswer {
    pub(super) response: ProviderHttpResponse,
    pub(super) created_message: Option<CreatedMessage>,
}

impl From<ProviderHttpResponse> for CloudAnswer {
    fn from(response: ProviderHttpResponse) -> Self {
        Self {
            response,
            created_message: None,
        }
    }
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

/// Meta's callback URL for replies to `app_number`: set when the `whatsapp_cloud` provider is
/// on, its business number is `app_number` and it has a `webhook_url`.
pub fn find_whatsapp_cloud_callback_url(
    providers: &[MessageProviderDefinition],
    app_number: &str,
) -> Option<String> {
    let cloud_provider = providers
        .iter()
        .find(|provider| provider.key == WHATSAPP_CLOUD_PROVIDER_KEY && provider.is_routable())?;
    let business_number =
        read_credential(cloud_provider, "phone_number").unwrap_or(DEFAULT_BUSINESS_NUMBER);
    (business_number == app_number)
        .then(|| read_credential(cloud_provider, "webhook_url").map(str::to_owned))
        .flatten()
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
    let Some(cloud_path) = read_cloud_path(&request.path) else {
        return Ok(None);
    };
    let cloud_answer = if has_valid_credentials(cloud_provider, request) {
        let cloud_request = CloudRequest {
            provider: cloud_provider,
            provider_route,
            request,
        };
        match answer_cloud_path(operation_context, &cloud_request, cloud_path).await? {
            Some(cloud_answer) => cloud_answer,
            None => return Ok(None),
        }
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

/// The request with the provider and route it came through.
struct CloudRequest<'request> {
    provider: &'request MessageProviderDefinition,
    provider_route: ProviderRoute<'request>,
    request: &'request ProviderHttpRequest,
}

/// Each path's answer by method; `None` for a method the path does not take.
async fn answer_cloud_path(
    operation_context: &OperationContext,
    cloud_request: &CloudRequest<'_>,
    cloud_path: CloudPath<'_>,
) -> Result<Option<CloudAnswer>, OperationError> {
    let request = cloud_request.request;
    let cloud_answer = match (request.method.as_str(), cloud_path) {
        ("POST", CloudPath::Messages { phone_number_id }) => {
            answer_messages_request(
                operation_context,
                cloud_request.provider,
                phone_number_id,
                request,
            )
            .await?
        }
        ("POST", CloudPath::MediaUpload { phone_number_id }) => {
            answer_media_upload(operation_context, phone_number_id, request)
                .await?
                .into()
        }
        ("GET", CloudPath::MediaObject { media_id }) => answer_media_lookup(
            operation_context,
            cloud_request.provider_route,
            request,
            media_id,
        )
        .await?
        .into(),
        ("DELETE", CloudPath::MediaObject { media_id }) => {
            answer_media_delete(operation_context, media_id)
                .await?
                .into()
        }
        _ => return Ok(None),
    };
    Ok(Some(cloud_answer))
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
        webhook_url: read_credential(cloud_provider, "webhook_url").map(str::to_owned),
    };
    answer_send(operation_context, &sender, &message).await
}
