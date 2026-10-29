use sendmock_store::MessageProviderRecord;

use super::builtin_providers::builtin_sms_providers;
use super::message_provider_definition::MessageProviderDefinition;
use crate::{OperationContext, OperationError};

/// The area SMS providers are stored under.
pub const SMS_PROVIDER_AREA: &str = "sms";

/// The providers SendMock ships for an area, as their definitions say.
pub fn list_shipped_providers(area: &str) -> Vec<MessageProviderDefinition> {
    match area {
        SMS_PROVIDER_AREA => builtin_sms_providers(),
        _ => Vec::new(),
    }
}

pub fn find_shipped_provider(area: &str, provider_key: &str) -> Option<MessageProviderDefinition> {
    list_shipped_providers(area)
        .into_iter()
        .find(|shipped_provider| shipped_provider.key == provider_key)
}

/// A built-in that differs from its shipped definition; removing it is not a change.
pub fn is_modified(provider: &MessageProviderDefinition) -> bool {
    if !provider.is_builtin {
        return false;
    }
    find_shipped_provider(&provider.area, &provider.key).is_some_and(|shipped_provider| {
        MessageProviderDefinition {
            is_removed: false,
            ..provider.clone()
        } != shipped_provider
    })
}

/// Every provider of an area as requests see it now: the built-ins with their stored changes,
/// then custom providers in the order they were added.
pub async fn load_area_providers(
    operation_context: &OperationContext,
    area: &str,
) -> Result<Vec<MessageProviderDefinition>, OperationError> {
    let stored_providers = operation_context
        .message_provider_repository
        .list_providers(area)
        .await?;
    let shipped_providers = list_shipped_providers(area);
    let custom_providers: Vec<MessageProviderDefinition> = stored_providers
        .iter()
        .filter(|stored_provider| {
            !shipped_providers
                .iter()
                .any(|shipped_provider| shipped_provider.key == stored_provider.provider_key)
        })
        .filter_map(read_stored_definition)
        .collect();
    let built_in_providers = shipped_providers.into_iter().map(|shipped_provider| {
        match stored_providers
            .iter()
            .find(|stored_provider| stored_provider.provider_key == shipped_provider.key)
        {
            Some(stored_provider) => apply_stored_changes(shipped_provider, stored_provider),
            None => shipped_provider,
        }
    });
    Ok(built_in_providers.chain(custom_providers).collect())
}

pub async fn find_area_provider(
    operation_context: &OperationContext,
    area: &str,
    provider_key: &str,
) -> Result<MessageProviderDefinition, OperationError> {
    load_area_providers(operation_context, area)
        .await?
        .into_iter()
        .find(|provider| provider.key == provider_key)
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No {area} provider with the key {provider_key}"),
        })
}

/// Stores the provider as it is now. A built-in kept as shipped stores nothing, or only that
/// it is removed, so an upgrade brings its new default.
pub async fn save_area_provider(
    operation_context: &OperationContext,
    provider: &MessageProviderDefinition,
) -> Result<(), OperationError> {
    let repository = &operation_context.message_provider_repository;
    let is_shipped_as_is = provider.is_builtin && !is_modified(provider);
    if is_shipped_as_is && !provider.is_removed {
        repository
            .delete_provider(&provider.area, &provider.key)
            .await?;
        return Ok(());
    }
    let definition_json = if is_shipped_as_is {
        None
    } else {
        Some(
            serde_json::to_string(provider)
                .map_err(|error| OperationError::Internal(error.to_string()))?,
        )
    };
    repository
        .save_provider(MessageProviderRecord {
            area: provider.area.clone(),
            provider_key: provider.key.clone(),
            definition_json,
            is_removed: provider.is_removed,
            updated_at_unix_ms: operation_context.clock.now_unix_ms(),
        })
        .await?;
    Ok(())
}

/// A stored definition that no longer parses answers as shipped.
fn apply_stored_changes(
    shipped_provider: MessageProviderDefinition,
    stored_provider: &MessageProviderRecord,
) -> MessageProviderDefinition {
    let stored_definition =
        read_stored_definition(stored_provider).unwrap_or(shipped_provider.clone());
    MessageProviderDefinition {
        key: shipped_provider.key,
        area: shipped_provider.area,
        is_builtin: true,
        is_removed: stored_provider.is_removed,
        ..stored_definition
    }
}

fn read_stored_definition(
    stored_provider: &MessageProviderRecord,
) -> Option<MessageProviderDefinition> {
    let stored_definition: MessageProviderDefinition =
        serde_json::from_str(stored_provider.definition_json.as_deref()?).ok()?;
    Some(MessageProviderDefinition {
        key: stored_provider.provider_key.clone(),
        area: stored_provider.area.clone(),
        is_removed: stored_provider.is_removed,
        ..stored_definition
    })
}
