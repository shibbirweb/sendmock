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

/// The streamable HTTP endpoint the server mounts at `/mcp`. On loopback only local Host
/// names are accepted, against DNS rebinding; a server reachable from other machines
/// (Docker) accepts any, and UI auth guards it.
pub fn build_mcp_http_service(
    mcp_server: SendmockMcpServer,
    is_reachable_from_other_machines: bool,
) -> rmcp::transport::streamable_http_server::StreamableHttpService<
    SendmockMcpServer,
    rmcp::transport::streamable_http_server::session::local::LocalSessionManager,
> {
    use rmcp::transport::streamable_http_server::{
        StreamableHttpServerConfig, StreamableHttpService,
    };

    let mut server_config = StreamableHttpServerConfig::default();
    if is_reachable_from_other_machines {
        server_config = server_config.disable_allowed_hosts();
    }
    StreamableHttpService::new(
        move || Ok(mcp_server.clone()),
        std::sync::Arc::default(),
        server_config,
    )
}

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
