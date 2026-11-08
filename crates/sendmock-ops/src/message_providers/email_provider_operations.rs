//! The email provider operations; each runs the shared area action for `email`.

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
use crate::providers::EMAIL_PROVIDER_AREA;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

pub struct ListEmailProvidersOperation;

impl Operation for ListEmailProvidersOperation {
    type Input = NoInput;
    type Output = Vec<MessageProviderView>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..provider_definition(
                "getEmailsProviders",
                HttpMethod::Get,
                "/api/v1/emails/providers",
                "Email providers, built in and custom, removed ones included.",
                "sendmock email providers list",
                "sendmock_email_provider_list",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<MessageProviderView>, OperationError> {
        list_area_provider_views(operation_context, EMAIL_PROVIDER_AREA).await
    }
}

pub struct CreateEmailProviderOperation;

impl Operation for CreateEmailProviderOperation {
    type Input = ProviderCreateRequest;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            ..provider_definition(
                "postEmailsProviders",
                HttpMethod::Post,
                "/api/v1/emails/providers",
                "Add an email provider, blank or copied from another.",
                "sendmock email providers create",
                "sendmock_email_provider_create",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderCreateRequest,
    ) -> Result<MessageProviderView, OperationError> {
        create_area_provider(operation_context, EMAIL_PROVIDER_AREA, input).await
    }
}

pub struct GetEmailProviderOperation;

impl Operation for GetEmailProviderOperation {
    type Input = ProviderReference;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..provider_definition(
                "getEmailsProvidersByProviderKey",
                HttpMethod::Get,
                "/api/v1/emails/providers/{providerKey}",
                "One provider definition; secret credentials masked.",
                "sendmock email providers show <providerKey>",
                "sendmock_email_provider_get",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderReference,
    ) -> Result<MessageProviderView, OperationError> {
        show_area_provider(operation_context, EMAIL_PROVIDER_AREA, &input.provider_key).await
    }
}

pub struct UpdateEmailProviderOperation;

impl Operation for UpdateEmailProviderOperation {
    type Input = ProviderUpdate;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        provider_definition(
            "patchEmailsProvidersByProviderKey",
            HttpMethod::Patch,
            "/api/v1/emails/providers/{providerKey}",
            "Change a provider; 400 with the problems for template errors, bad paths or a path clash.",
            "sendmock email providers update <providerKey>",
            "sendmock_email_provider_update",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderUpdate,
    ) -> Result<MessageProviderView, OperationError> {
        update_area_provider(operation_context, EMAIL_PROVIDER_AREA, input).await
    }
}

pub struct DeleteEmailProviderOperation;

impl Operation for DeleteEmailProviderOperation {
    type Input = ProviderReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_destructive: true,
            success_status: SuccessStatus::NoContent,
            ..provider_definition(
                "deleteEmailsProvidersByProviderKey",
                HttpMethod::Delete,
                "/api/v1/emails/providers/{providerKey}",
                "Remove a built-in (restorable) or delete a custom provider; its messages stay.",
                "sendmock email providers delete <providerKey>",
                "sendmock_email_provider_delete",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderReference,
    ) -> Result<NoContent, OperationError> {
        delete_area_provider(operation_context, EMAIL_PROVIDER_AREA, &input.provider_key).await?;
        Ok(NoContent)
    }
}

pub struct RestoreEmailProviderOperation;

impl Operation for RestoreEmailProviderOperation {
    type Input = ProviderReference;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        provider_definition(
            "postEmailsProvidersByProviderKeyRestore",
            HttpMethod::Post,
            "/api/v1/emails/providers/{providerKey}/restore",
            "Bring a removed built-in back as it was.",
            "sendmock email providers restore <providerKey>",
            "sendmock_email_provider_restore",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderReference,
    ) -> Result<MessageProviderView, OperationError> {
        restore_area_provider(operation_context, EMAIL_PROVIDER_AREA, &input.provider_key).await
    }
}

pub struct ResetEmailProviderOperation;

impl Operation for ResetEmailProviderOperation {
    type Input = ProviderReference;
    type Output = MessageProviderView;

    fn definition(&self) -> OperationDefinition {
        provider_definition(
            "postEmailsProvidersByProviderKeyReset",
            HttpMethod::Post,
            "/api/v1/emails/providers/{providerKey}/reset",
            "Put a built-in provider back as shipped.",
            "sendmock email providers reset <providerKey>",
            "sendmock_email_provider_reset",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderReference,
    ) -> Result<MessageProviderView, OperationError> {
        reset_area_provider(operation_context, EMAIL_PROVIDER_AREA, &input.provider_key).await
    }
}

pub struct PreviewEmailProviderOperation;

impl Operation for PreviewEmailProviderOperation {
    type Input = ProviderPreviewRequest;
    type Output = MessageProviderPreview;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..provider_definition(
                "postEmailsProvidersByProviderKeyPreview",
                HttpMethod::Post,
                "/api/v1/emails/providers/{providerKey}/preview",
                "Run a sample request through a definition: the message it would store and the answer it would give.",
                "sendmock email providers preview <providerKey>",
                "sendmock_email_provider_preview",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderPreviewRequest,
    ) -> Result<MessageProviderPreview, OperationError> {
        preview_area_provider(operation_context, EMAIL_PROVIDER_AREA, input).await
    }
}

pub struct RevealEmailProviderCredentialOperation;

impl Operation for RevealEmailProviderCredentialOperation {
    type Input = ProviderCredentialReference;
    type Output = ProviderCredentialReveal;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            revealed_secret_field: Some("value"),
            ..provider_definition(
                "getEmailsProvidersByProviderKeyCredentialsByCredentialName",
                HttpMethod::Get,
                "/api/v1/emails/providers/{providerKey}/credentials/{credentialName}",
                "Reveal one secret credential (asked for after a confirmation).",
                "sendmock email providers credential <providerKey> <credentialName> --reveal",
                "",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ProviderCredentialReference,
    ) -> Result<ProviderCredentialReveal, OperationError> {
        reveal_area_credential(operation_context, EMAIL_PROVIDER_AREA, input).await
    }
}
