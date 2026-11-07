mod credential_masking;
mod email_provider_operations;
mod preview_response;
mod provider_area_actions;
mod provider_inputs;
mod provider_presenter;
mod provider_preview;
mod provider_rules;
mod provider_views;
mod sample_request_builder;
mod sms_provider_operations;
mod template_reference;
mod whatsapp_webhook_verification;

pub use credential_masking::mask_secret_value;
pub(crate) use credential_masking::{mask_secret_credentials, merge_credentials};
pub use email_provider_operations::{
    CreateEmailProviderOperation, DeleteEmailProviderOperation, GetEmailProviderOperation,
    ListEmailProvidersOperation, PreviewEmailProviderOperation, ResetEmailProviderOperation,
    RestoreEmailProviderOperation, RevealEmailProviderCredentialOperation,
    UpdateEmailProviderOperation,
};
pub(crate) use provider_area_actions::{
    create_area_provider, delete_area_provider, reset_area_provider, restore_area_provider,
    update_area_provider,
};
pub use provider_inputs::{MessageProviderInput, ProviderSampleRequest};
pub(crate) use provider_inputs::{ProviderCreateRequest, ProviderUpdate};
pub use provider_views::{MessageProviderPreview, MessageProviderView, ProviderCredentialReveal};
pub use sms_provider_operations::{
    CreateSmsProviderOperation, DeleteSmsProviderOperation, GetSmsProviderOperation,
    ListSmsProvidersOperation, PreviewSmsProviderOperation, ResetSmsProviderOperation,
    RestoreSmsProviderOperation, RevealSmsProviderCredentialOperation, UpdateSmsProviderOperation,
};
pub(crate) use template_reference::{
    TemplateHelperEntry, TemplateReference, build_template_reference,
};

pub use whatsapp_webhook_verification::{
    VerifyWhatsappWebhookOperation, WhatsappWebhookVerification, WhatsappWebhookVerificationRequest,
};

use crate::OperationRegistry;

/// The SMS and email provider operations, custom providers included.
pub fn register_sms_provider_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListSmsProvidersOperation);
    operation_registry.register(CreateSmsProviderOperation);
    operation_registry.register(GetSmsProviderOperation);
    operation_registry.register(UpdateSmsProviderOperation);
    operation_registry.register(DeleteSmsProviderOperation);
    operation_registry.register(RestoreSmsProviderOperation);
    operation_registry.register(ResetSmsProviderOperation);
    operation_registry.register(PreviewSmsProviderOperation);
    operation_registry.register(RevealSmsProviderCredentialOperation);
    operation_registry.register(VerifyWhatsappWebhookOperation);
    operation_registry.register(ListEmailProvidersOperation);
    operation_registry.register(CreateEmailProviderOperation);
    operation_registry.register(GetEmailProviderOperation);
    operation_registry.register(UpdateEmailProviderOperation);
    operation_registry.register(DeleteEmailProviderOperation);
    operation_registry.register(RestoreEmailProviderOperation);
    operation_registry.register(ResetEmailProviderOperation);
    operation_registry.register(PreviewEmailProviderOperation);
    operation_registry.register(RevealEmailProviderCredentialOperation);
}
