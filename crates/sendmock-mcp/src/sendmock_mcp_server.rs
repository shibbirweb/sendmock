use std::sync::Arc;

use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, ContentBlock, Implementation,
    InitializeResult, ListToolsResult, PaginatedRequestParams, ServerCapabilities, Tool,
    ToolAnnotations,
};
use rmcp::service::RequestContext;
use rmcp::{ErrorData as McpError, RoleServer, ServerHandler};
use sendmock_ops::{FileAnswer, OperationAnswer};

use crate::McpToolDefinition;
use crate::mcp_tool_catalog::{McpToolCatalog, ToolOutcome};

const SERVER_INSTRUCTIONS: &str = "SendMock catches the email (and later SMS, webhooks and payments) your app sends while \
     you develop. Read captured mail with sendmock_email_list and sendmock_email_get, wait for one with \
     sendmock_email_wait, and read codes and links with sendmock_otp_get and sendmock_links_get.";

/// The MCP server: lists the catalog's tools and runs them.
#[derive(Clone)]
pub struct SendmockMcpServer {
    tool_catalog: Arc<McpToolCatalog>,
    version: &'static str,
}

impl SendmockMcpServer {
    pub fn new(tool_catalog: McpToolCatalog, version: &'static str) -> Self {
        Self {
            tool_catalog: Arc::new(tool_catalog),
            version,
        }
    }
}

impl ServerHandler for SendmockMcpServer {
    fn get_info(&self) -> InitializeResult {
        InitializeResult::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("sendmock", self.version))
            .with_instructions(SERVER_INSTRUCTIONS)
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, McpError> {
        Ok(ListToolsResult::with_all_items(
            self.tool_catalog
                .tool_definitions()
                .map(to_mcp_tool)
                .collect(),
        ))
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, McpError> {
        let tool_outcome = self
            .tool_catalog
            .call_tool(&request.name, request.arguments.unwrap_or_default())
            .await;
        Ok(to_call_tool_result(tool_outcome).into())
    }
}

fn to_mcp_tool(tool_definition: &McpToolDefinition) -> Tool {
    let input_schema = tool_definition
        .input_schema
        .as_object()
        .cloned()
        .unwrap_or_default();
    let mut mcp_tool = Tool::new(
        tool_definition.name.clone(),
        tool_definition.description.clone(),
        input_schema,
    );
    let annotations = tool_definition.annotations;
    mcp_tool.annotations = Some(ToolAnnotations::from_raw(
        None,
        Some(annotations.read_only_hint),
        Some(annotations.destructive_hint),
        Some(annotations.idempotent_hint),
        Some(false),
    ));
    mcp_tool
}

fn is_text_content_type(content_type: &str) -> bool {
    content_type.starts_with("text/")
        || matches!(
            content_type,
            "application/json" | "application/toml" | "application/xml"
        )
}

/// A text file, such as an exported template, comes back as its text; any other file is
/// described, to be read as a resource.
fn describe_file_answer(file_answer: FileAnswer) -> String {
    if is_text_content_type(&file_answer.content_type)
        && let Ok(file_text) = String::from_utf8(file_answer.bytes.clone())
    {
        return file_text;
    }
    format!(
        "A {} file of {} bytes; read it as a resource.",
        file_answer.content_type,
        file_answer.bytes.len()
    )
}

/// JSON answers come back as compact JSON, objects also as structured content; failures as
/// tool errors the model can read and act on.
fn to_call_tool_result(tool_outcome: ToolOutcome) -> CallToolResult {
    match tool_outcome {
        ToolOutcome::Answer(OperationAnswer::Json(json_answer)) if json_answer.is_object() => {
            CallToolResult::structured(json_answer)
        }
        ToolOutcome::Answer(OperationAnswer::Json(json_answer)) => {
            CallToolResult::success(vec![ContentBlock::text(json_answer.to_string())])
        }
        ToolOutcome::Answer(OperationAnswer::File(file_answer)) => {
            CallToolResult::success(vec![ContentBlock::text(describe_file_answer(file_answer))])
        }
        ToolOutcome::Answer(OperationAnswer::Empty) => {
            CallToolResult::success(vec![ContentBlock::text("Done.")])
        }
        ToolOutcome::Failure(failure_message) => {
            CallToolResult::error(vec![ContentBlock::text(failure_message)])
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file_answer(content_type: &str, bytes: &[u8]) -> FileAnswer {
        FileAnswer {
            content_type: content_type.to_owned(),
            file_name: None,
            bytes: bytes.to_vec(),
        }
    }

    #[test]
    fn a_text_file_comes_back_as_its_text() {
        let described_file =
            describe_file_answer(file_answer("application/toml", b"name = \"Ops\""));

        assert_eq!(described_file, "name = \"Ops\"");
    }

    #[test]
    fn a_binary_file_is_described_to_read_as_a_resource() {
        let described_file = describe_file_answer(file_answer("application/pdf", &[0, 159, 146]));

        assert_eq!(
            described_file,
            "A application/pdf file of 3 bytes; read it as a resource."
        );
    }
}
