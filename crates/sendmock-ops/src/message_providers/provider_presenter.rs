use std::collections::HashMap;

use super::provider_views::MessageProviderView;
use crate::providers::{MessageProviderDefinition, SMS_PROVIDER_AREA};
use crate::{HttpMethod, OperationContext, OperationDefinition, OperationError};

const DAY_MS: i64 = 24 * 60 * 60 * 1000;

/// Messages each provider caught in the last 24 hours, by provider key.
async fn count_recent_messages(
    operation_context: &OperationContext,
    area: &str,
) -> Result<HashMap<String, u32>, OperationError> {
    if area != SMS_PROVIDER_AREA {
        return Ok(HashMap::new());
    }
    let since_unix_ms = operation_context.clock.now_unix_ms() - DAY_MS;
    Ok(operation_context
        .sms_repository
        .count_messages_by_api_since(since_unix_ms)
        .await?)
}

/// The providers as the API answers them: secrets masked, Modified and recent message counts.
pub async fn present_providers(
    operation_context: &OperationContext,
    area: &str,
    providers: Vec<MessageProviderDefinition>,
) -> Result<Vec<MessageProviderView>, OperationError> {
    let recent_message_counts = count_recent_messages(operation_context, area).await?;
    Ok(providers
        .into_iter()
        .map(|provider| {
            let message_count_24h = recent_message_counts
                .get(&provider.key)
                .copied()
                .unwrap_or_default();
            MessageProviderView::present(provider, message_count_24h)
        })
        .collect())
}

pub async fn present_provider(
    operation_context: &OperationContext,
    provider: MessageProviderDefinition,
) -> Result<MessageProviderView, OperationError> {
    let area = provider.area.clone();
    let mut presented = present_providers(operation_context, &area, vec![provider]).await?;
    presented
        .pop()
        .ok_or_else(|| OperationError::Internal("the provider was not presented".to_owned()))
}

/// The definition every SMS provider operation shares; each names only what differs.
pub fn sms_provider_definition(
    operation_id: &'static str,
    method: HttpMethod,
    path: &'static str,
    summary: &'static str,
    cli_usage: &'static str,
    mcp_tool: &'static str,
) -> OperationDefinition {
    OperationDefinition {
        operation_id,
        method,
        path,
        summary,
        cli_usage,
        mcp_tool,
        ..OperationDefinition::DEFAULTS
    }
}
