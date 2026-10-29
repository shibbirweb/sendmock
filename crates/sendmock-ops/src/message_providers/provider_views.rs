use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::Serialize;

use super::credential_masking::mask_secret_credentials;
use super::provider_inputs::MessageProviderInput;
use super::template_reference::TemplateReference;
use crate::providers::{MessageProviderDefinition, is_modified};

/// An email or SMS provider SendMock answers like the real one, secrets masked.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct MessageProviderView {
    #[serde(flatten)]
    pub settings: MessageProviderInput,
    /// `email` or `sms`.
    pub area: String,
    /// Shipped with SendMock; it can be reset, removed and restored, not deleted.
    pub is_builtin: bool,
    /// A built-in that differs from its shipped default.
    pub is_modified: bool,
    /// A built-in taken out of routing, pickers and snippets; Restore brings it back.
    pub is_removed: bool,
    /// Messages it caught in the last 24 hours.
    pub message_count_24h: u32,
}

impl MessageProviderView {
    pub fn present(provider: MessageProviderDefinition, message_count_24h: u32) -> Self {
        let is_modified = is_modified(&provider);
        let area = provider.area.clone();
        let is_builtin = provider.is_builtin;
        let is_removed = provider.is_removed;
        let mut settings = MessageProviderInput::from(provider);
        settings.credentials = mask_secret_credentials(&settings.credentials);
        Self {
            settings,
            area,
            is_builtin,
            is_modified,
            is_removed,
            message_count_24h,
        }
    }
}

/// One credential in plain text, for the CLI and UI after a confirmation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct ProviderCredentialReveal {
    pub name: String,
    pub value: String,
}

/// A problem with a provider's settings, named by the part it is in.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct ProviderDefinitionProblem {
    pub part: String,
    pub message: String,
    /// `error` refuses a save; `warning` does not.
    pub severity: String,
}

/// The message SendMock would store for the sample request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct PreviewStoredMessage {
    pub from: String,
    pub to: Vec<String>,
    /// The email subject; null for SMS.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub subject: Option<String>,
    pub body: String,
    pub metadata: BTreeMap<String, String>,
}

/// The answer SendMock would give.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct PreviewResponse {
    pub status: u16,
    pub headers: BTreeMap<String, String>,
    pub body: String,
}

/// What a sample request becomes: the message SendMock would store and the answer it would give.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct MessageProviderPreview {
    /// The operation the request matched, or null when none matched.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub operation_kind: Option<String>,
    /// The message SendMock would store; null when the request is refused.
    #[schemars(
        required,
        schema_with = "crate::nullable_schema::<PreviewStoredMessage>"
    )]
    pub stored_message: Option<PreviewStoredMessage>,
    pub response: PreviewResponse,
    pub problems: Vec<ProviderDefinitionProblem>,
    /// What templates can read, for `{{` suggestions.
    pub reference: TemplateReference,
}
