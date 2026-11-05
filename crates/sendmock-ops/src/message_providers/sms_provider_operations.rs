//! The SMS provider operations; each runs the shared area action for `sms`.

use super::provider_area_actions::{
    create_area_provider, delete_area_provider, list_area_provider_views, preview_area_provider,
    reset_area_provider, restore_area_provider, reveal_area_credential, show_area_provider,
    update_area_provider,
};
use super::provider_inputs::{
    ProviderCreateRequest, ProviderCredentialReference, ProviderPreviewRequest, ProviderReference,
    ProviderUpdate,
};
use super::provider_presenter::provider_definition;
use super::provider_views::{
    MessageProviderPreview, MessageProviderView, ProviderCredentialReveal,
};
use crate::providers::SMS_PROVIDER_AREA;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

pub struct ListSmsProvidersOperation;

impl Operation for ListSmsProvidersOperation {
    type Input = NoInput;
    type Output = Vec<MessageProviderView>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..provider_definition(
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
        list_area_provider_views(operation_context, SMS_PROVIDER_AREA).await
    }
}

pub struct CreateSmsProviderOperation;

impl Operation for CreateSmsProviderOperation {
    type Input = ProviderCreateRequest;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            ..provider_definition(
                "postSmsProviders",
                HttpMethod::Post,
                "/api/v1/sms/providers",
                "Add an SMS provider, blank or copied from another.",
                "sendmock sms providers create",
                "sendmock_sms_provider_create",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderCreateRequest,
    ) -> Result<MessageProviderView, OperationError> {
        create_area_provider(operation_context, SMS_PROVIDER_AREA, input).await
    }
}

pub struct GetSmsProviderOperation;

impl Operation for GetSmsProviderOperation {
    type Input = ProviderReference;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..provider_definition(
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
        show_area_provider(operation_context, SMS_PROVIDER_AREA, &input.provider_key).await
    }
}

pub struct UpdateSmsProviderOperation;

impl Operation for UpdateSmsProviderOperation {
    type Input = ProviderUpdate;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        provider_definition(
            "patchSmsProvidersByProviderKey",
            HttpMethod::Patch,
            "/api/v1/sms/providers/{providerKey}",
            "Change a provider; 400 with the problems for template errors, bad paths or a path clash.",
            "sendmock sms providers update <providerKey>",
            "sendmock_sms_provider_update",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderUpdate,
    ) -> Result<MessageProviderView, OperationError> {
        update_area_provider(operation_context, SMS_PROVIDER_AREA, input).await
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
            ..provider_definition(
                "deleteSmsProvidersByProviderKey",
                HttpMethod::Delete,
                "/api/v1/sms/providers/{providerKey}",
                "Remove a built-in (restorable) or delete a custom provider; its messages stay.",
                "sendmock sms providers delete <providerKey>",
                "sendmock_sms_provider_delete",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderReference,
    ) -> Result<NoContent, OperationError> {
        delete_area_provider(operation_context, SMS_PROVIDER_AREA, &input.provider_key).await?;
        Ok(NoContent)
    }
}

pub struct RestoreSmsProviderOperation;

impl Operation for RestoreSmsProviderOperation {
    type Input = ProviderReference;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        provider_definition(
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
        restore_area_provider(operation_context, SMS_PROVIDER_AREA, &input.provider_key).await
    }
}

pub struct ResetSmsProviderOperation;

impl Operation for ResetSmsProviderOperation {
    type Input = ProviderReference;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        provider_definition(
            "postSmsProvidersByProviderKeyReset",
            HttpMethod::Post,
            "/api/v1/sms/providers/{providerKey}/reset",
            "Put a built-in provider back as shipped.",
            "sendmock sms providers reset <providerKey>",
            "sendmock_sms_provider_reset",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderReference,
    ) -> Result<MessageProviderView, OperationError> {
        reset_area_provider(operation_context, SMS_PROVIDER_AREA, &input.provider_key).await
    }
}

pub struct PreviewSmsProviderOperation;

impl Operation for PreviewSmsProviderOperation {
    type Input = ProviderPreviewRequest;
    type Output = MessageProviderPreview;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..provider_definition(
                "postSmsProvidersByProviderKeyPreview",
                HttpMethod::Post,
                "/api/v1/sms/providers/{providerKey}/preview",
                "Run a sample request through a definition: the message it would store and the answer it would give.",
                "sendmock sms providers preview <providerKey>",
                "sendmock_sms_provider_preview",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderPreviewRequest,
    ) -> Result<MessageProviderPreview, OperationError> {
        preview_area_provider(operation_context, SMS_PROVIDER_AREA, input).await
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
            ..provider_definition(
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
        reveal_area_credential(operation_context, SMS_PROVIDER_AREA, input).await
    }
}
