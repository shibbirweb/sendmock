//! What each provider operation does, for one area (`sms` or `email`): the SMS and email
//! operations differ only in their paths and names.

use super::credential_masking::merge_credentials;
use super::provider_inputs::{
    ProviderCreateRequest, ProviderCredentialReference, ProviderPreviewRequest, ProviderUpdate,
};
use super::provider_presenter::{present_provider, present_providers};
use super::provider_preview::preview_provider;
use super::provider_rules::check_provider_can_be_saved;
use super::provider_views::{
    MessageProviderPreview, MessageProviderView, ProviderCredentialReveal,
};
use crate::providers::{
    MessageProviderDefinition, ProviderHeaderTemplate, ProviderOperation, ProviderResponseTemplate,
    find_area_provider, find_shipped_provider, load_area_providers, save_area_provider,
};
use crate::{OperationContext, OperationError};

/// 2 to 32 lowercase letters, digits or `_`, starting with a letter.
fn is_valid_provider_key(provider_key: &str) -> bool {
    (2..=32).contains(&provider_key.len())
        && provider_key.starts_with(|first: char| first.is_ascii_lowercase())
        && provider_key.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '_'
        })
}

pub async fn list_area_provider_views(
    operation_context: &OperationContext,
    area: &str,
) -> Result<Vec<MessageProviderView>, OperationError> {
    let providers = load_area_providers(operation_context, area).await?;
    present_providers(operation_context, area, providers).await
}

pub async fn show_area_provider(
    operation_context: &OperationContext,
    area: &str,
    provider_key: &str,
) -> Result<MessageProviderView, OperationError> {
    let provider = find_area_provider(operation_context, area, provider_key).await?;
    present_provider(operation_context, provider).await
}

/// Stores nothing: the settings run as sent, with the stored secrets behind masked values.
pub async fn preview_area_provider(
    operation_context: &OperationContext,
    area: &str,
    input: ProviderPreviewRequest,
) -> Result<MessageProviderPreview, OperationError> {
    let stored_provider = find_area_provider(operation_context, area, &input.provider_key).await?;
    Ok(preview_provider(operation_context, &stored_provider, input))
}

pub async fn reveal_area_credential(
    operation_context: &OperationContext,
    area: &str,
    input: ProviderCredentialReference,
) -> Result<ProviderCredentialReveal, OperationError> {
    let provider = find_area_provider(operation_context, area, &input.provider_key).await?;
    provider
        .credentials
        .into_iter()
        .find(|credential| credential.name == input.credential_name)
        .map(|credential| ProviderCredentialReveal {
            name: credential.name,
            value: credential.value,
        })
        .ok_or_else(|| OperationError::NotFound {
            message: format!(
                "{} has no credential named {}",
                provider.name, input.credential_name
            ),
        })
}

pub async fn update_area_provider(
    operation_context: &OperationContext,
    area: &str,
    input: ProviderUpdate,
) -> Result<MessageProviderView, OperationError> {
    let area_providers = load_area_providers(operation_context, area).await?;
    let stored_provider = area_providers
        .iter()
        .find(|provider| provider.key == input.provider_key)
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No {area} provider with the key {}", input.provider_key),
        })?;
    let mut changed_provider = input.changes.apply_to(stored_provider);
    changed_provider.credentials =
        merge_credentials(&stored_provider.credentials, changed_provider.credentials);
    check_provider_can_be_saved(operation_context, &changed_provider, &area_providers)?;
    save_area_provider(operation_context, &changed_provider).await?;
    present_provider(operation_context, changed_provider).await
}

/// A built-in is removed (and can be restored); a custom provider is deleted. Its messages stay.
pub async fn delete_area_provider(
    operation_context: &OperationContext,
    area: &str,
    provider_key: &str,
) -> Result<(), OperationError> {
    let mut provider = find_area_provider(operation_context, area, provider_key).await?;
    if provider.is_builtin {
        provider.is_removed = true;
        save_area_provider(operation_context, &provider).await
    } else {
        operation_context
            .message_provider_repository
            .delete_provider(area, &provider.key)
            .await?;
        Ok(())
    }
}

pub async fn restore_area_provider(
    operation_context: &OperationContext,
    area: &str,
    provider_key: &str,
) -> Result<MessageProviderView, OperationError> {
    let mut provider = find_area_provider(operation_context, area, provider_key).await?;
    if !provider.is_removed {
        return Err(OperationError::Conflict {
            code: "not_removed",
            message: format!("{} is not removed", provider.name),
        });
    }
    provider.is_removed = false;
    save_area_provider(operation_context, &provider).await?;
    present_provider(operation_context, provider).await
}

pub async fn reset_area_provider(
    operation_context: &OperationContext,
    area: &str,
    provider_key: &str,
) -> Result<MessageProviderView, OperationError> {
    let provider = find_area_provider(operation_context, area, provider_key).await?;
    let shipped_provider =
        find_shipped_provider(area, &provider.key).ok_or_else(|| OperationError::Conflict {
            code: "not_builtin",
            message: "Only built-in providers have a default to go back to".to_owned(),
        })?;
    let reset_provider = MessageProviderDefinition {
        is_removed: provider.is_removed,
        ..shipped_provider
    };
    save_area_provider(operation_context, &reset_provider).await?;
    present_provider(operation_context, reset_provider).await
}

/// The mock's `validateNewProvider`: a key of 2 to 32 lowercase letters, digits or `_`
/// starting with a letter, not `native`, unique in its area, and a name.
fn check_new_provider(
    input: &ProviderCreateRequest,
    area_providers: &[MessageProviderDefinition],
) -> Result<(), OperationError> {
    let is_valid_key = is_valid_provider_key(&input.key);
    if !is_valid_key || input.key == "native" {
        return Err(OperationError::InvalidInput {
            message: if input.key == "native" {
                "native is SendMock's own API; choose another key".to_owned()
            } else {
                "Use 2 to 32 lowercase letters, digits or _, starting with a letter".to_owned()
            },
            field: Some("key".to_owned()),
        });
    }
    if area_providers
        .iter()
        .any(|provider| provider.key == input.key)
    {
        return Err(OperationError::Conflict {
            code: "provider_exists",
            message: format!("A provider with the key {} already exists", input.key),
        });
    }
    if input.name.trim().is_empty() {
        return Err(OperationError::InvalidInput {
            message: "Enter a name".to_owned(),
            field: Some("name".to_owned()),
        });
    }
    Ok(())
}

/// A blank provider: one send request and nothing mapped yet, as the mock starts one.
fn build_blank_provider(area: &str) -> MessageProviderDefinition {
    MessageProviderDefinition {
        area: area.to_owned(),
        accent: "#64748b".to_owned(),
        operations: vec![ProviderOperation {
            kind: "send".to_owned(),
            method: "POST".to_owned(),
            path: "/send".to_owned(),
            request_format: "json".to_owned(),
        }],
        success_response: ProviderResponseTemplate {
            status: 200,
            headers: vec![ProviderHeaderTemplate {
                name: "Content-Type".to_owned(),
                template: "application/json".to_owned(),
            }],
            body: r#"{"id": "{{ message.provider_id }}", "status": "queued"}"#.to_owned(),
        },
        message_id_template: "{{ uuid() }}".to_owned(),
        ..MessageProviderDefinition::default()
    }
}

/// A custom provider copied from another of the same area (on its own host, so their paths
/// do not clash) or blank.
pub async fn create_area_provider(
    operation_context: &OperationContext,
    area: &str,
    input: ProviderCreateRequest,
) -> Result<MessageProviderView, OperationError> {
    let area_providers = load_area_providers(operation_context, area).await?;
    check_new_provider(&input, &area_providers)?;
    let start_from = input.start_from.as_deref().and_then(|start_from_key| {
        area_providers
            .iter()
            .find(|provider| provider.key == start_from_key)
            .cloned()
    });
    let host = start_from
        .as_ref()
        .map(|_| format!("{}.example.test", input.key));
    let created_provider = MessageProviderDefinition {
        key: input.key,
        name: input.name.trim().to_owned(),
        host,
        is_builtin: false,
        is_removed: false,
        is_enabled: true,
        ..start_from.unwrap_or_else(|| build_blank_provider(area))
    };
    save_area_provider(operation_context, &created_provider).await?;
    present_provider(operation_context, created_provider).await
}
