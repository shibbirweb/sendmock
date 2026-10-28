use std::future::Future;

use schemars::JsonSchema;
use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::{OperationContext, OperationError};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

impl HttpMethod {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Get => "GET",
            Self::Post => "POST",
            Self::Put => "PUT",
            Self::Patch => "PATCH",
            Self::Delete => "DELETE",
        }
    }
}

/// Picks one operation when several share an MCP tool: an extra input with a fixed value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OperationSelector {
    pub input_name: &'static str,
    pub value: &'static str,
}

/// A `<placeholder>` in a CLI usage and the input it fills; `reads_file` sends the named
/// file's text instead of the path.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CliArgument {
    pub placeholder: &'static str,
    pub input_name: &'static str,
    pub reads_file: bool,
}

/// What every surface needs to know about an operation, named as in `docs/api/openapi.yaml`
/// and the surface catalogue, so the binary serves exactly the commands and tools documented.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperationDefinition {
    pub operation_id: &'static str,
    pub method: HttpMethod,
    pub path: &'static str,
    pub summary: &'static str,
    pub is_read_only: bool,
    /// The CLI command with its positional arguments, e.g. `sendmock seed validate <file>`.
    pub cli_usage: &'static str,
    pub mcp_tool: &'static str,
    pub selector: Option<OperationSelector>,
    pub cli_arguments: &'static [CliArgument],
    /// A boolean output field that must be true for the CLI to exit 0, such as `is_valid`.
    pub success_flag_field: Option<&'static str>,
}

/// One feature, defined once: typed input, typed output and the handler (the Command pattern).
pub trait Operation: Send + Sync + 'static {
    type Input: DeserializeOwned + JsonSchema + Send + 'static;
    type Output: Serialize + JsonSchema + Send + 'static;

    fn definition(&self) -> OperationDefinition;

    fn execute(
        &self,
        operation_context: &OperationContext,
        input: Self::Input,
    ) -> impl Future<Output = Result<Self::Output, OperationError>> + Send;
}
