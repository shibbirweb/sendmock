use super::credential_masking::merge_credentials;
use super::provider_inputs::{ProviderReference, ProviderUpdate};
use super::provider_presenter::{present_provider, sms_provider_definition};
use super::provider_rules::check_provider_can_be_saved;
use super::provider_views::MessageProviderView;
use crate::providers::{
    MessageProviderDefinition, SMS_PROVIDER_AREA, find_area_provider, find_shipped_provider,
    load_area_providers, save_area_provider,
};
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

pub struct UpdateSmsProviderOperation;

impl Operation for UpdateSmsProviderOperation {
    type Input = ProviderUpdate;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        sms_provider_definition(
            "patchSmsProvidersByProviderKey",
            HttpMethod::Patch,
            "/api/v1/sms/providers/{providerKey}",
            "Change a provider; 400 with the problems for template errors, bad paths or a path clash.",
            "sendmock sms providers update <providerKey>",
            "sendmock_sms_provider_update",
        )
    }

    /// The key in the path wins over the body's; a masked secret keeps the stored value. The
    /// change applies to the next request.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderUpdate,
    ) -> Result<MessageProviderView, OperationError> {
        let area_providers = load_area_providers(operation_context, SMS_PROVIDER_AREA).await?;
        let stored_provider = area_providers
            .iter()
            .find(|provider| provider.key == input.provider_key)
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No sms provider with the key {}", input.provider_key),
            })?;
        let mut changed_provider = input.changes.apply_to(stored_provider);
        changed_provider.credentials =
            merge_credentials(&stored_provider.credentials, changed_provider.credentials);
        check_provider_can_be_saved(operation_context, &changed_provider, &area_providers)?;
        save_area_provider(operation_context, &changed_provider).await?;
        present_provider(operation_context, changed_provider).await
    }
}

pub struct DeleteSmsProviderOperation;

impl Operation for DeleteSmsProviderOperation {
    type Input = ProviderReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_destructive: true,
            success_status: SuccessStatus::NoContent,
            ..sms_provider_definition(
                "deleteSmsProvidersByProviderKey",
                HttpMethod::Delete,
                "/api/v1/sms/providers/{providerKey}",
                "Remove a built-in (restorable) or delete a custom provider; its messages stay.",
                "sendmock sms providers delete <providerKey>",
                "sendmock_sms_provider_delete",
            )
        }
    }

    /// A built-in is removed and can be restored; a custom provider is deleted. Messages keep
    /// the provider's key either way.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderReference,
    ) -> Result<NoContent, OperationError> {
        let mut provider =
            find_area_provider(operation_context, SMS_PROVIDER_AREA, &input.provider_key).await?;
        if provider.is_builtin {
            provider.is_removed = true;
            save_area_provider(operation_context, &provider).await?;
        } else {
            operation_context
                .message_provider_repository
                .delete_provider(SMS_PROVIDER_AREA, &provider.key)
                .await?;
        }
        Ok(NoContent)
    }
}

pub struct RestoreSmsProviderOperation;

impl Operation for RestoreSmsProviderOperation {
    type Input = ProviderReference;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        sms_provider_definition(
            "postSmsProvidersByProviderKeyRestore",
            HttpMethod::Post,
            "/api/v1/sms/providers/{providerKey}/restore",
            "Bring a removed built-in back as it was.",
            "sendmock sms providers restore <providerKey>",
            "sendmock_sms_provider_restore",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderReference,
    ) -> Result<MessageProviderView, OperationError> {
        let mut provider =
            find_area_provider(operation_context, SMS_PROVIDER_AREA, &input.provider_key).await?;
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
}

pub struct ResetSmsProviderOperation;

impl Operation for ResetSmsProviderOperation {
    type Input = ProviderReference;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        sms_provider_definition(
            "postSmsProvidersByProviderKeyReset",
            HttpMethod::Post,
            "/api/v1/sms/providers/{providerKey}/reset",
            "Put a built-in provider back as shipped.",
            "sendmock sms providers reset <providerKey>",
            "sendmock_sms_provider_reset",
        )
    }

    /// A removed built-in stays removed; Restore brings it back.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderReference,
    ) -> Result<MessageProviderView, OperationError> {
        let provider =
            find_area_provider(operation_context, SMS_PROVIDER_AREA, &input.provider_key).await?;
        let shipped_provider =
            find_shipped_provider(SMS_PROVIDER_AREA, &provider.key).ok_or_else(|| {
                OperationError::Conflict {
                    code: "not_builtin",
                    message: "Only built-in providers have a default to go back to".to_owned(),
                }
            })?;
        let reset_provider = MessageProviderDefinition {
            is_removed: provider.is_removed,
            ..shipped_provider
        };
        save_area_provider(operation_context, &reset_provider).await?;
        present_provider(operation_context, reset_provider).await
    }
}
