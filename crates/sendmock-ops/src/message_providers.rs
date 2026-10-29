mod credential_masking;
mod preview_response;
mod provider_inputs;
mod provider_presenter;
mod provider_preview;
mod provider_rules;
mod provider_views;
mod sample_request_builder;
mod sms_provider_change_operations;
mod sms_provider_read_operations;
mod template_reference;

pub use credential_masking::mask_secret_value;
pub use provider_inputs::{MessageProviderInput, ProviderSampleRequest};
pub use provider_views::{MessageProviderPreview, MessageProviderView, ProviderCredentialReveal};
pub use sms_provider_change_operations::{
    DeleteSmsProviderOperation, ResetSmsProviderOperation, RestoreSmsProviderOperation,
    UpdateSmsProviderOperation,
};
pub use sms_provider_read_operations::{
    GetSmsProviderOperation, ListSmsProvidersOperation, PreviewSmsProviderOperation,
    RevealSmsProviderCredentialOperation,
};

use crate::OperationRegistry;

/// The SMS provider operations this build serves; adding providers comes with custom
/// providers in Phase 4.
pub fn register_sms_provider_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListSmsProvidersOperation);
    operation_registry.register(GetSmsProviderOperation);
    operation_registry.register(UpdateSmsProviderOperation);
    operation_registry.register(DeleteSmsProviderOperation);
    operation_registry.register(RestoreSmsProviderOperation);
    operation_registry.register(ResetSmsProviderOperation);
    operation_registry.register(PreviewSmsProviderOperation);
    operation_registry.register(RevealSmsProviderCredentialOperation);
}
