use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::message_providers::{
    DeleteSmsProviderOperation, ProviderReference, ProviderUpdate, ResetSmsProviderOperation,
    RestoreSmsProviderOperation, UpdateSmsProviderOperation,
};
use crate::providers::{
    MessageProviderDefinition, SMS_PROVIDER_AREA, find_area_provider, find_shipped_provider,
    is_modified, load_area_providers,
};
use crate::seed::seed_section_adapter::{
    SeedItem, impl_seed_section_adapter, read_seed_table, to_api_input, to_secret_reference,
    write_seed_table,
};
use crate::seed::seed_sections::SMS_PROVIDERS_SECTION;
use crate::{Operation, OperationContext, OperationError};

/// `[[sms.providers]]`, matched by `key`: an edited or removed built-in, with its definition as
/// JSON and secret credentials as `${ENV_VAR}` references. Custom providers come in Phase 4 and
/// are skipped until then.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedSmsProvider {
    key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(default)]
    edits_builtin: bool,
    #[serde(default)]
    removed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    definition: Option<String>,
}

fn provider_reference(provider_key: &str) -> ProviderReference {
    ProviderReference {
        provider_key: provider_key.to_owned(),
    }
}

pub struct SmsProviderSeedAdapter;

impl SmsProviderSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let seed_provider: SeedSmsProvider = read_seed_table(item_table)?;
        let provider_key = seed_provider.key.trim().to_owned();
        if find_shipped_provider(SMS_PROVIDER_AREA, &provider_key).is_none() {
            tracing::warn!(
                provider_key,
                "custom SMS providers come in Phase 4; skipped"
            );
            return Ok(provider_key);
        }
        let current_provider =
            find_area_provider(operation_context, SMS_PROVIDER_AREA, &provider_key).await?;
        if seed_provider.removed {
            if !current_provider.is_removed {
                DeleteSmsProviderOperation
                    .execute(operation_context, provider_reference(&provider_key))
                    .await?;
            }
            return Ok(provider_key);
        }
        if current_provider.is_removed {
            RestoreSmsProviderOperation
                .execute(operation_context, provider_reference(&provider_key))
                .await?;
        }
        if let Some(definition_text) = &seed_provider.definition {
            let provider_update =
                read_provider_update(&provider_key, definition_text, &current_provider)?;
            UpdateSmsProviderOperation
                .execute(operation_context, provider_update)
                .await?;
        }
        Ok(provider_key)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let area_providers = load_area_providers(operation_context, SMS_PROVIDER_AREA).await?;
        let mut seed_items = Vec::new();
        for provider in area_providers {
            let is_edited = is_modified(&provider);
            if !provider.is_builtin || !(is_edited || provider.is_removed) {
                continue;
            }
            let definition = is_edited.then(|| write_definition(&provider)).transpose()?;
            seed_items.push(SeedItem {
                item_key: provider.key.clone(),
                item_name: provider.name.clone(),
                table: write_seed_table(&SeedSmsProvider {
                    key: provider.key,
                    name: Some(provider.name),
                    edits_builtin: true,
                    removed: provider.is_removed,
                    definition,
                })?,
            });
        }
        Ok(seed_items)
    }

    /// Puts edited or removed built-ins the seed does not hold back as shipped.
    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let area_providers = load_area_providers(operation_context, SMS_PROVIDER_AREA).await?;
        for provider in area_providers {
            let is_changed = is_modified(&provider) || provider.is_removed;
            if provider.is_builtin && is_changed && !kept_item_keys.contains(&provider.key) {
                ResetSmsProviderOperation
                    .execute(operation_context, provider_reference(&provider.key))
                    .await?;
                let reset_provider =
                    find_area_provider(operation_context, SMS_PROVIDER_AREA, &provider.key).await?;
                if reset_provider.is_removed {
                    RestoreSmsProviderOperation
                        .execute(operation_context, provider_reference(&provider.key))
                        .await?;
                }
            }
        }
        Ok(())
    }
}

/// The definition as JSON with each secret credential replaced by its reference.
fn write_definition(provider: &MessageProviderDefinition) -> Result<String, OperationError> {
    let mut exported_provider = provider.clone();
    for credential in &mut exported_provider.credentials {
        if credential.is_secret {
            credential.value =
                to_secret_reference(&format!("{}_{}", provider.key, credential.name));
        }
    }
    serde_json::to_string(&exported_provider)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

/// The update for the seeded definition; a secret credential left empty (an unset
/// `${ENV_VAR}`) keeps the value it has.
fn read_provider_update(
    provider_key: &str,
    definition_text: &str,
    current_provider: &MessageProviderDefinition,
) -> Result<ProviderUpdate, OperationError> {
    let mut definition_fields: Value =
        serde_json::from_str(definition_text).map_err(|read_error| {
            OperationError::InvalidInput {
                message: format!("definition is not valid JSON: {read_error}"),
                field: Some("definition".to_owned()),
            }
        })?;
    if let Some(credentials) = definition_fields["credentials"].as_array_mut() {
        for credential in credentials {
            let is_empty_secret = credential["is_secret"] == Value::Bool(true)
                && credential["value"].as_str().is_some_and(str::is_empty);
            let credential_name = credential["name"].as_str().unwrap_or_default().to_owned();
            if let Some(current_credential) =
                current_provider
                    .credentials
                    .iter()
                    .find(|current_credential| {
                        is_empty_secret && current_credential.name == credential_name
                    })
            {
                credential["value"] = Value::from(current_credential.value.clone());
            }
        }
    }
    definition_fields["provider_key"] = Value::from(provider_key);
    definition_fields["key"] = Value::from(provider_key);
    to_api_input(definition_fields)
}

impl_seed_section_adapter!(SmsProviderSeedAdapter, SMS_PROVIDERS_SECTION);
