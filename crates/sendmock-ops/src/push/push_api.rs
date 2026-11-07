use super::fcm_send_api::answer_fcm_send;
use crate::providers::{ProviderHttpRequest, ProviderOutcome, ProviderRoute};
use crate::{OperationContext, OperationError};

/// The push providers' APIs, on the provider port at their real paths or under
/// `/providers/<key>/`.
pub async fn answer_push_api(
    operation_context: &OperationContext,
    provider_route: ProviderRoute<'_>,
    request: &ProviderHttpRequest,
) -> Result<Option<ProviderOutcome>, OperationError> {
    if !matches!(
        provider_route,
        ProviderRoute::ProviderPort | ProviderRoute::Prefixed("fcm")
    ) {
        return Ok(None);
    }
    Ok(answer_fcm_send(operation_context, request)
        .await?
        .map(|response| ProviderOutcome {
            response,
            provider_key: Some("fcm".to_owned()),
            created_message: None,
            secret_values: Vec::new(),
        }))
}
