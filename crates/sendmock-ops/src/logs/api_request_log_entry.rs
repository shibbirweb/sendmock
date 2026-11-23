use std::collections::BTreeMap;

use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::ApiRequestRecord;
use serde::Serialize;

/// What an accepted request created, for the "Open message" link.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct ApiRequestLinkedMessage {
    /// `email` or `sms`.
    pub kind: String,
    pub id: String,
    /// Conversation of a linked SMS, for the "Open message" link.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub sms_thread_id: Option<String>,
}

/// The HTTP Catcher bin and rule that answered a provider request no built-in operation
/// answers.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct ApiRequestCatcherAnswer {
    pub bin_name: String,
    /// Null when the bin's default reply answered.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub rule_name: Option<String>,
}

/// One request to a native or provider API, with the exact response it got.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct ApiRequestLogEntry {
    pub id: String,
    pub api: String,
    pub method: String,
    pub path: String,
    pub request_headers: BTreeMap<String, String>,
    pub request_body: String,
    pub response_status: u16,
    pub response_body: String,
    pub duration_ms: u64,
    /// The SMS or email this request created; null for rejected requests.
    #[schemars(
        required,
        schema_with = "crate::nullable_schema::<ApiRequestLinkedMessage>"
    )]
    pub linked_message: Option<ApiRequestLinkedMessage>,
    /// The attached bin and rule that answered; null when SendMock answered itself.
    #[schemars(
        required,
        schema_with = "crate::nullable_schema::<ApiRequestCatcherAnswer>"
    )]
    pub catcher_answer: Option<ApiRequestCatcherAnswer>,
    /// Why SendMock answered as it did when the answer alone does not say, such as the reason
    /// for a Twilio 401; null otherwise.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub note: Option<String>,
    pub created_at: String,
}

impl From<ApiRequestRecord> for ApiRequestLogEntry {
    fn from(request: ApiRequestRecord) -> Self {
        Self {
            id: request.request_id,
            api: request.api,
            method: request.method,
            path: request.path,
            request_headers: request.request_headers,
            request_body: request.request_body,
            response_status: request.response_status,
            response_body: request.response_body,
            duration_ms: request.duration_ms,
            linked_message: request
                .linked_message
                .map(|(kind, id)| ApiRequestLinkedMessage {
                    kind,
                    id,
                    sms_thread_id: None,
                }),
            catcher_answer: request
                .catcher_answer
                .map(|catcher_answer| ApiRequestCatcherAnswer {
                    bin_name: catcher_answer.bin_name,
                    rule_name: catcher_answer.rule_name,
                }),
            note: request.note,
            created_at: format_rfc3339(request.created_at_unix_ms),
        }
    }
}
