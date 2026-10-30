use super::provider_inputs::{
    ProviderCredentialReference, ProviderPreviewRequest, ProviderReference,
};
use super::provider_presenter::{present_provider, present_providers, sms_provider_definition};
use super::provider_preview::preview_provider;
use super::provider_views::{
    MessageProviderPreview, MessageProviderView, ProviderCredentialReveal,
};
use crate::providers::{SMS_PROVIDER_AREA, find_area_provider, load_area_providers};
use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError,
};

pub struct ListSmsProvidersOperation;

impl Operation for ListSmsProvidersOperation {
    type Input = NoInput;
    type Output = Vec<MessageProviderView>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..sms_provider_definition(
                "getSmsProviders",
                HttpMethod::Get,
                "/api/v1/sms/providers",
                "SMS providers, built in and custom, removed ones included.",
                "sendmock sms providers list",
                "sendmock_sms_provider_list",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<MessageProviderView>, OperationError> {
        let providers = load_area_providers(operation_context, SMS_PROVIDER_AREA).await?;
        present_providers(operation_context, SMS_PROVIDER_AREA, providers).await
    }
}

pub struct GetSmsProviderOperation;

impl Operation for GetSmsProviderOperation {
    type Input = ProviderReference;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..sms_provider_definition(
                "getSmsProvidersByProviderKey",
                HttpMethod::Get,
                "/api/v1/sms/providers/{providerKey}",
                "One provider definition; secret credentials masked.",
                "sendmock sms providers show <providerKey>",
                "sendmock_sms_provider_get",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderReference,
    ) -> Result<MessageProviderView, OperationError> {
        let provider =
            find_area_provider(operation_context, SMS_PROVIDER_AREA, &input.provider_key).await?;
        present_provider(operation_context, provider).await
    }
}

pub struct PreviewSmsProviderOperation;

impl Operation for PreviewSmsProviderOperation {
    type Input = ProviderPreviewRequest;
    type Output = MessageProviderPreview;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..sms_provider_definition(
                "postSmsProvidersByProviderKeyPreview",
                HttpMethod::Post,
                "/api/v1/sms/providers/{providerKey}/preview",
                "Run a sample request through a definition: the message it would store and the answer it would give.",
                "sendmock sms providers preview <providerKey>",
                "sendmock_sms_provider_preview",
            )
        }
    }

    /// Stores nothing: the settings run as sent, with the stored secrets behind masked values.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderPreviewRequest,
    ) -> Result<MessageProviderPreview, OperationError> {
        let stored_provider =
            find_area_provider(operation_context, SMS_PROVIDER_AREA, &input.provider_key).await?;
        Ok(preview_provider(operation_context, &stored_provider, input))
    }
}

pub struct RevealSmsProviderCredentialOperation;

impl Operation for RevealSmsProviderCredentialOperation {
    type Input = ProviderCredentialReference;
    type Output = ProviderCredentialReveal;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            revealed_secret_field: Some("value"),
            ..sms_provider_definition(
                "getSmsProvidersByProviderKeyCredentialsByCredentialName",
                HttpMethod::Get,
                "/api/v1/sms/providers/{providerKey}/credentials/{credentialName}",
                "Reveal one secret credential (asked for after a confirmation).",
                "sendmock sms providers credential <providerKey> <credentialName> --reveal",
                "",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderCredentialReference,
    ) -> Result<ProviderCredentialReveal, OperationError> {
        let provider =
            find_area_provider(operation_context, SMS_PROVIDER_AREA, &input.provider_key).await?;
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
}
