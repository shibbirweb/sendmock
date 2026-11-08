use super::expo_push_api::answer_expo_push;
use super::fcm_send_api::answer_fcm_send;
use super::onesignal_notifications_api::answer_onesignal_notification;
use crate::providers::{ProviderHttpRequest, ProviderHttpResponse, ProviderOutcome, ProviderRoute};
use crate::{OperationContext, OperationError};

const PUSH_PROVIDER_KEYS: [&str; 3] = ["fcm", "expo", "onesignal"];

/// Answers the request as one push provider, or `None` when it is not that provider's API.
async fn answer_as_provider(
    operation_context: &OperationContext,
    provider_key: &str,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderHttpResponse>, OperationError> {
    match provider_key {
        "fcm" => answer_fcm_send(operation_context, request).await,
        "expo" => answer_expo_push(operation_context, request).await,
        "onesignal" => answer_onesignal_notification(operation_context, request).await,
        _ => Ok(None),
    }
}

/// The push providers' APIs, on the provider port at their real paths or under
/// `/providers/<key>/`.
pub async fn answer_push_api(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    let candidate_keys: Vec<&str> = match provider_route {
        ProviderRoute::ProviderPort => PUSH_PROVIDER_KEYS.to_vec(),
        ProviderRoute::Prefixed(provider_key) if PUSH_PROVIDER_KEYS.contains(&provider_key) => {
            vec![provider_key]
        }
        ProviderRoute::Prefixed(_) => Vec::new(),
    };
    for provider_key in candidate_keys {
        if let Some(response) = answer_as_provider(operation_context, provider_key, request).await?
        {
            return Ok(Some(ProviderOutcome {
                response,
                provider_key: Some(provider_key.to_owned()),
                created_message: None,
                secret_values: Vec::new(),
            }));
        }
    }
    Ok(None)
}
