use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// One part of the message's multipart tree.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct MimePart {
    pub part_id: String,
    pub content_type: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub transfer_encoding: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub charset: Option<String>,
    pub size_bytes: u64,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub filename: Option<String>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub content_id: Option<String>,
    pub children: Vec<MimePart>,
}
