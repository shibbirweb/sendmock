//! The MCP server, with one tool per operation.

mod mcp_tool_definition;
mod tool_definitions_builder;

pub use mcp_tool_definition::{McpToolAnnotations, McpToolDefinition};
pub use tool_definitions_builder::build_tool_definitions;
