use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::MessageOpenRecord;
use serde::Serialize;

/// One open of an email or SMS, as the open history lists it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct OpenRecord {
    pub opened_at: String,
    /// `ui`, `manual` or `api`.
    pub source: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub user_agent: Option<String>,
}

impl From<MessageOpenRecord> for OpenRecord {
    fn from(message_open: MessageOpenRecord) -> Self {
        Self {
            opened_at: format_rfc3339(message_open.opened_at_unix_ms),
            source: message_open.source,
            user_agent: message_open.user_agent,
        }
    }
}
