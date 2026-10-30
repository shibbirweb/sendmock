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
            created_at: format_rfc3339(request.created_at_unix_ms),
        }
    }
}
