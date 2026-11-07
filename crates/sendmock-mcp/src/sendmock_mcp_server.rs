use std::sync::Arc;

use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, ContentBlock, GetPromptRequestParams,
    GetPromptResponse, GetPromptResult, Implementation, InitializeResult, ListPromptsResult,
    ListResourceTemplatesResult, ListResourcesResult, ListToolsResult, PaginatedRequestParams,
    ReadResourceRequestParams, ReadResourceResponse, ReadResourceResult, Resource,
    ServerCapabilities, SubscribeRequestParams, Tool, ToolAnnotations, UnsubscribeRequestParams,
};
use rmcp::service::RequestContext;
use rmcp::{ErrorData as McpError, RoleServer, ServerHandler};
use sendmock_ops::{FileAnswer, OperationAnswer};

use crate::McpToolDefinition;
use crate::mcp_prompts::{build_prompt_messages, list_prompts};
use crate::mcp_resources::{
    find_answer_uri, list_fixed_resources, list_resource_templates, read_resource,
};
use crate::mcp_tool_catalog::{McpToolCatalog, ToolOutcome};
use crate::resource_subscriptions::ResourceSubscriptions;

/// Strings longer than this in a tool's answer are left to its resource.
const LONGEST_INLINE_TEXT: usize = 4_000;

const SERVER_INSTRUCTIONS: &str = "SendMock catches the email, SMS, payments and HTTP calls your app sends while \
     you develop, and sends the provider webhooks it expects. Read the skill at sendmock://docs/skill first. \
     Wait for a message with sendmock_email_wait or sendmock_sms_wait and read codes and links with \
     sendmock_otp_get and sendmock_links_get; large bodies come back as resource links to read on purpose.";

/// The MCP server: lists the catalog's tools and runs them.
#[derive(Clone)]
pub struct SendmockMcpServer {
    tool_catalog: Arc<McpToolCatalog>,
    resource_subscriptions: Arc<ResourceSubscriptions>,
    version: &'static str,
}

impl SendmockMcpServer {
    pub fn new(tool_catalog: McpToolCatalog, version: &'static str) -> Self {
        Self {
            tool_catalog: Arc::new(tool_catalog),
            resource_subscriptions: Arc::default(),
            version,
        }
    }
}

impl ServerHandler for SendmockMcpServer {
    fn get_info(&self) -> InitializeResult {
        let capabilities = ServerCapabilities::builder()
            .enable_tools()
            .enable_resources()
            .enable_resources_subscribe()
            .enable_prompts()
            .build();
        InitializeResult::new(capabilities)
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
        let arguments = request.arguments.unwrap_or_default();
        let answer_uri = find_answer_uri(
            &self.tool_catalog.read_tool_operation_ids(&request.name),
            &arguments,
        );
        let tool_outcome = self.tool_catalog.call_tool(&request.name, arguments).await;
        Ok(to_call_tool_result(tool_outcome, answer_uri.as_deref()).into())
    }

    async fn list_resources(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListResourcesResult, McpError> {
        Ok(ListResourcesResult::with_all_items(list_fixed_resources()))
    }

    async fn list_resource_templates(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListResourceTemplatesResult, McpError> {
        Ok(ListResourceTemplatesResult::with_all_items(
            list_resource_templates(),
        ))
    }

    async fn read_resource(
        &self,
        request: ReadResourceRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<ReadResourceResponse, McpError> {
        let resource_contents = read_resource(&self.tool_catalog, &request.uri)
            .await
            .map_err(|read_problem| McpError::invalid_params(read_problem, None))?;
        Ok(ReadResourceResult::new(vec![resource_contents]).into())
    }

    async fn subscribe(
        &self,
        request: SubscribeRequestParams,
        context: RequestContext<RoleServer>,
    ) -> Result<(), McpError> {
        self.resource_subscriptions.subscribe(
            request.uri,
            context.peer,
            Arc::clone(&self.tool_catalog),
        );
        Ok(())
    }

    async fn unsubscribe(
        &self,
        request: UnsubscribeRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<(), McpError> {
        self.resource_subscriptions.unsubscribe(&request.uri);
        Ok(())
    }

    async fn list_prompts(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListPromptsResult, McpError> {
        Ok(ListPromptsResult::with_all_items(list_prompts()))
    }

    async fn get_prompt(
        &self,
        request: GetPromptRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<GetPromptResponse, McpError> {
        let prompt_messages =
            build_prompt_messages(&request.name, &request.arguments.unwrap_or_default())
                .map_err(|prompt_problem| McpError::invalid_params(prompt_problem, None))?;
        Ok(GetPromptResult::new(prompt_messages).into())
    }
}

/// Shortens strings too long for the model's context; whether any was shortened.
fn shorten_long_texts(json_value: &mut serde_json::Value, answer_uri: &str) -> bool {
    match json_value {
        serde_json::Value::String(text) if text.chars().count() > LONGEST_INLINE_TEXT => {
            *text = format!(
                "({} characters; read the resource {answer_uri})",
                text.chars().count()
            );
            true
        }
        serde_json::Value::Array(entries) => {
            entries
                .iter_mut()
                .map(|entry| shorten_long_texts(entry, answer_uri))
                .filter(|was_shortened| *was_shortened)
                .count()
                > 0
        }
        serde_json::Value::Object(fields) => {
            fields
                .values_mut()
                .map(|field| shorten_long_texts(field, answer_uri))
                .filter(|was_shortened| *was_shortened)
                .count()
                > 0
        }
        _ => false,
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
fn to_call_tool_result(tool_outcome: ToolOutcome, answer_uri: Option<&str>) -> CallToolResult {
    let Some(answer_uri) = answer_uri else {
        return to_plain_tool_result(tool_outcome);
    };
    let resource_link = ContentBlock::resource_link(Resource::new(answer_uri, "answer"));
    match tool_outcome {
        ToolOutcome::Answer(OperationAnswer::Json(json_answer)) => {
            let mut shortened_answer = json_answer.clone();
            if shorten_long_texts(&mut shortened_answer, answer_uri) {
                return CallToolResult::success(vec![
                    ContentBlock::text(shortened_answer.to_string()),
                    resource_link,
                ]);
            }
            to_plain_tool_result(ToolOutcome::Answer(OperationAnswer::Json(json_answer)))
        }
        ToolOutcome::Answer(OperationAnswer::File(file_answer))
            if !is_text_content_type(&file_answer.content_type) =>
        {
            CallToolResult::success(vec![
                ContentBlock::text(describe_file_answer(file_answer)),
                resource_link,
            ])
        }
        other_outcome => to_plain_tool_result(other_outcome),
    }
}

fn to_plain_tool_result(tool_outcome: ToolOutcome) -> CallToolResult {
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
