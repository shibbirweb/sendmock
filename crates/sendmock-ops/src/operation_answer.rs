use schemars::JsonSchema;
use serde::Serialize;
use serde_json::Value;

/// A file an operation answers with, such as a raw message or an attachment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct FileAnswer {
    pub content_type: String,
    pub file_name: Option<String>,
    #[serde(skip)]
    #[schemars(skip)]
    pub bytes: Vec<u8>,
}

/// The output of an operation whose answer has no body.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, JsonSchema)]
pub struct NoContent;

/// What an operation answered, ready for any surface to send on.
#[derive(Debug, Clone, PartialEq)]
pub enum OperationAnswer {
    Json(Value),
    File(FileAnswer),
    Empty,
}
