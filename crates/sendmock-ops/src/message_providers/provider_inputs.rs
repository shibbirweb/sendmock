use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::providers::{
    MessageProviderDefinition, ProviderCredential, ProviderErrorResponse, ProviderFieldMapping,
    ProviderOperation, ProviderResponseTemplate, ProviderValidationRule,
};

/// The settings of a provider a user can change: the definition without its area and the
/// read-only fields. Body of `PATCH .../providers/{providerKey}`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct MessageProviderInput {
    /// The provider's key; fixed after creation, so the path's key wins.
    pub key: String,
    /// The provider's name, shown on messages and in pickers.
    pub name: String,
    /// `#rrggbb`, used on its badge.
    pub accent: String,
    /// Off providers answer nothing; their paths get SendMock's native 404.
    pub is_enabled: bool,
    /// The provider's API host, used on the provider port to tell apart providers that share
    /// a path; null when not needed.
    #[schemars(required)]
    pub host: Option<String>,
    /// The credentials your app is configured with; a masked secret keeps the stored value.
    pub credentials: Vec<ProviderCredential>,
    /// Off: any credentials are accepted. On: wrong ones get the `unauthorized` answer.
    pub check_credentials: bool,
    /// The requests it answers.
    pub operations: Vec<ProviderOperation>,
    /// Where each part of a sent message is read from.
    pub field_mapping: Vec<ProviderFieldMapping>,
    /// The checks run on each send, in order.
    pub validation_rules: Vec<ProviderValidationRule>,
    /// The answer to a request that passes every check.
    pub success_response: ProviderResponseTemplate,
    /// The answer for each kind of error.
    pub error_responses: Vec<ProviderErrorResponse>,
    /// The provider's id for each message, a template.
    pub message_id_template: String,
    /// The webhook template its status callbacks are sent with; null sends none.
    #[schemars(required)]
    pub callback_template_key: Option<String>,
    /// The provider's name for each SendMock status.
    pub status_names: BTreeMap<String, String>,
    /// SMS only: the provider's error code for each delivery outcome.
    pub outcome_error_codes: BTreeMap<String, String>,
}

impl From<MessageProviderDefinition> for MessageProviderInput {
    fn from(provider: MessageProviderDefinition) -> Self {
        Self {
            key: provider.key,
            name: provider.name,
            accent: provider.accent,
            is_enabled: provider.is_enabled,
            host: provider.host,
            credentials: provider.credentials,
            check_credentials: provider.check_credentials,
            operations: provider.operations,
            field_mapping: provider.field_mapping,
            validation_rules: provider.validation_rules,
            success_response: provider.success_response,
            error_responses: provider.error_responses,
            message_id_template: provider.message_id_template,
            callback_template_key: provider.callback_template_key,
            status_names: provider.status_names,
            outcome_error_codes: provider.outcome_error_codes,
        }
    }
}

impl MessageProviderInput {
    /// The input applied to a stored provider; its key, area and built-in state stay.
    pub fn apply_to(
        self,
        stored_provider: &MessageProviderDefinition,
    ) -> MessageProviderDefinition {
        MessageProviderDefinition {
            key: stored_provider.key.clone(),
            area: stored_provider.area.clone(),
            is_builtin: stored_provider.is_builtin,
            is_removed: stored_provider.is_removed,
            name: self.name,
            accent: self.accent,
            is_enabled: self.is_enabled,
            host: self.host,
            credentials: self.credentials,
            check_credentials: self.check_credentials,
            operations: self.operations,
            field_mapping: self.field_mapping,
            validation_rules: self.validation_rules,
            success_response: self.success_response,
            error_responses: self.error_responses,
            message_id_template: self.message_id_template,
            callback_template_key: self.callback_template_key,
            status_names: self.status_names,
            outcome_error_codes: self.outcome_error_codes,
        }
    }
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ProviderReference {
    /// The provider's key, e.g. `twilio`, from its providers list.
    pub provider_key: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ProviderUpdate {
    /// The provider's key, e.g. `twilio`, from its providers list.
    pub provider_key: String,
    #[serde(flatten)]
    pub changes: MessageProviderInput,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ProviderCredentialReference {
    /// The provider's key, e.g. `twilio`, from its providers list.
    pub provider_key: String,
    /// The credential's name in the provider, e.g. `auth_token`.
    pub credential_name: String,
}

/// A request to run through a provider in the preview.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct ProviderSampleRequest {
    /// The HTTP method.
    pub method: String,
    /// The path as your app would call it.
    pub path: String,
    /// The request headers.
    pub headers: BTreeMap<String, String>,
    /// The raw request body.
    pub body: String,
}

/// Body of `POST .../providers/{providerKey}/preview`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct ProviderPreviewRequest {
    /// The provider's key, e.g. `twilio`, from its providers list.
    pub provider_key: String,
    /// The provider settings to run, saved or not.
    pub provider: MessageProviderInput,
    /// The request to run; the provider's example send when left out.
    pub sample_request: Option<ProviderSampleRequest>,
}
