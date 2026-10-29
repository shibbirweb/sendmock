//! The MCP server, with one tool per operation.

mod mcp_tool_catalog;
mod mcp_tool_definition;
mod operation_runner;
mod sendmock_mcp_server;
mod tool_definitions_builder;
mod toolsets;

pub use mcp_tool_catalog::{McpToolCatalog, ToolOutcome};
pub use mcp_tool_definition::{McpToolAnnotations, McpToolDefinition};
pub use operation_runner::{InProcessOperationRunner, OperationRunner, RunFuture};
pub use sendmock_mcp_server::SendmockMcpServer;
pub use tool_definitions_builder::build_tool_definitions;
pub use toolsets::{DEFAULT_TOOLSETS, ToolFilter, find_toolset};

/// Serves MCP over stdin and stdout until the client disconnects.
pub async fn serve_mcp_over_stdio(mcp_server: SendmockMcpServer) -> Result<(), String> {
    use rmcp::ServiceExt;

    let running_service = mcp_server
        .serve(rmcp::transport::stdio())
        .await
        .map_err(|serve_error| serve_error.to_string())?;
    running_service
        .waiting()
        .await
        .map(|_| ())
        .map_err(|join_error| join_error.to_string())
}
