use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// An email or SMS provider as data: the requests it answers, how it reads them and what it
/// answers (docs/plan/22-configurable-providers.md). Built-ins are definitions too.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct MessageProviderDefinition {
    pub key: String,
    pub name: String,
    pub area: String,
    pub accent: String,
    pub is_enabled: bool,
    pub host: Option<String>,
    pub credentials: Vec<ProviderCredential>,
    pub check_credentials: bool,
    pub operations: Vec<ProviderOperation>,
    pub field_mapping: Vec<ProviderFieldMapping>,
    pub validation_rules: Vec<ProviderValidationRule>,
    pub success_response: ProviderResponseTemplate,
    pub error_responses: Vec<ProviderErrorResponse>,
    pub message_id_template: String,
    pub callback_template_key: Option<String>,
    pub status_names: BTreeMap<String, String>,
    pub outcome_error_codes: BTreeMap<String, String>,
    pub is_builtin: bool,
    pub is_removed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ProviderCredential {
    pub name: String,
    pub value: String,
    pub is_secret: bool,
}

/// One request the provider answers: `send`, `fetch`, `list`, `cancel`, ...
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ProviderOperation {
    pub kind: String,
    pub method: String,
    /// `{name}` marks a variable part.
    pub path: String,
    /// `json`, `form`, `multipart` or `query`.
    pub request_format: String,
}

/// Where a message part (`to`, `body`, ...) is read from in the request.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ProviderFieldMapping {
    pub part: String,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ProviderValidationRule {
    pub part: String,
    /// `required`, `email_address`, `e164_number` or `max_length`.
    pub check: String,
    pub max_length: Option<usize>,
    pub error_kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ProviderResponseTemplate {
    pub status: u16,
    pub headers: Vec<ProviderHeaderTemplate>,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ProviderHeaderTemplate {
    pub name: String,
    pub template: String,
}

/// The answer for one error kind: `missing_field`, `invalid_value`, `unauthorized`,
/// `not_found` or `rate_limited`.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ProviderErrorResponse {
    pub kind: String,
    pub status: u16,
    pub headers: Vec<ProviderHeaderTemplate>,
    pub body: String,
}

impl ProviderErrorResponse {
    pub fn as_response_template(&self) -> ProviderResponseTemplate {
        ProviderResponseTemplate {
            status: self.status,
            headers: self.headers.clone(),
            body: self.body.clone(),
        }
    }
}

impl MessageProviderDefinition {
    /// Whether requests reach it: enabled and not removed.
    pub fn is_routable(&self) -> bool {
        self.is_enabled && !self.is_removed
    }

    pub fn find_error_response(&self, error_kind: &str) -> Option<&ProviderErrorResponse> {
        self.error_responses
            .iter()
            .find(|error_response| error_response.kind == error_kind)
    }

    pub fn find_credential(&self, credential_name: &str) -> Option<&str> {
        self.credentials
            .iter()
            .find(|credential| credential.name == credential_name)
            .map(|credential| credential.value.as_str())
    }

    /// The provider's name for a SendMock status, or the status itself.
    pub fn status_name<'status>(&'status self, sendmock_status: &'status str) -> &'status str {
        self.status_names
            .get(sendmock_status)
            .map_or(sendmock_status, String::as_str)
    }
}
