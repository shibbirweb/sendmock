use std::sync::Arc;

use sendmock_ops::{ErasedOperation, HttpMethod, OperationRegistry};
use serde_json::{Map, Value, json};

use crate::{McpToolAnnotations, McpToolDefinition};

/// One tool per MCP name in the registry, in registration order. Operations that share a
/// tool are told apart by their selector input, as the surface catalogue defines them.
pub fn build_tool_definitions(operation_registry: &OperationRegistry) -> Vec<McpToolDefinition> {
    let mut operations_by_tool: Vec<(&'static str, Vec<Arc<dyn ErasedOperation>>)> = Vec::new();
    let tool_operations = operation_registry
        .operations()
        .iter()
        .filter(|operation| !operation.definition().has_mcp_resource());
    for operation in tool_operations {
        let tool_name = operation.definition().mcp_tool;
        match operations_by_tool
            .iter_mut()
            .find(|(name, _)| *name == tool_name)
        {
            Some((_, tool_operations)) => tool_operations.push(Arc::clone(operation)),
            None => operations_by_tool.push((tool_name, vec![Arc::clone(operation)])),
        }
    }
    operations_by_tool
        .into_iter()
        .map(|(tool_name, tool_operations)| build_tool_definition(tool_name, &tool_operations))
        .collect()
}

fn build_tool_definition(
    tool_name: &str,
    tool_operations: &[Arc<dyn ErasedOperation>],
) -> McpToolDefinition {
    McpToolDefinition {
        name: tool_name.to_owned(),
        description: describe_tool(tool_operations),
        input_schema: merge_input_schemas(tool_operations),
        annotations: annotate_tool(tool_operations),
        operation_ids: tool_operations
            .iter()
            .map(|operation| operation.definition().operation_id.to_owned())
            .collect(),
    }
}

fn describe_tool(tool_operations: &[Arc<dyn ErasedOperation>]) -> String {
    tool_operations
        .iter()
        .map(|operation| {
            let definition = operation.definition();
            match definition.selector {
                Some(selector) => {
                    format!(
                        "{}={}: {}",
                        selector.input_name, selector.value, definition.summary
                    )
                }
                None => definition.summary.to_owned(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// The union of the operations' inputs, plus the selector input naming which one runs.
fn merge_input_schemas(tool_operations: &[Arc<dyn ErasedOperation>]) -> Value {
    let mut properties = Map::new();
    let mut required_inputs: Vec<Value> = Vec::new();
    for operation in tool_operations {
        let input_schema = operation.input_schema().to_value();
        if let Some(operation_properties) = input_schema["properties"].as_object() {
            properties.extend(operation_properties.clone());
        }
        if tool_operations.len() == 1 {
            required_inputs = input_schema["required"]
                .as_array()
                .cloned()
                .unwrap_or_default();
        }
    }
    let selectors: Vec<_> = tool_operations
        .iter()
        .filter_map(|operation| operation.definition().selector)
        .collect();
    if let Some(first_selector) = selectors.first() {
        let selector_values: Vec<&str> = selectors.iter().map(|selector| selector.value).collect();
        properties.insert(
            first_selector.input_name.to_owned(),
            json!({ "type": "string", "enum": selector_values }),
        );
        required_inputs.push(Value::from(first_selector.input_name));
    }
    json!({ "type": "object", "properties": properties, "required": required_inputs })
}

/// Read-only operations read only, destructive ones destructive; PUT, PATCH and DELETE
/// idempotent (docs/plan/21-reference-and-examples.md).
fn annotate_tool(tool_operations: &[Arc<dyn ErasedOperation>]) -> McpToolAnnotations {
    let methods: Vec<HttpMethod> = tool_operations
        .iter()
        .map(|operation| operation.definition().method)
        .collect();
    let is_read_only = tool_operations
        .iter()
        .all(|operation| operation.definition().is_read_only);
    McpToolAnnotations {
        read_only_hint: is_read_only,
        destructive_hint: tool_operations
            .iter()
            .any(|operation| operation.definition().is_destructive),
        idempotent_hint: !is_read_only
            && methods.iter().all(|method| {
                matches!(
                    method,
                    HttpMethod::Put | HttpMethod::Patch | HttpMethod::Delete
                )
            }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_and_info_share_the_status_tool_told_apart_by_view() {
        let tool_definitions = build_tool_definitions(&sendmock_ops::build_operation_registry());

        let status_tool = tool_definitions
            .iter()
            .find(|tool| tool.name == "sendmock_status");
        insta::assert_json_snapshot!(status_tool);
    }

    #[test]
    fn the_status_tool_is_read_only() {
        let tool_definitions = build_tool_definitions(&sendmock_ops::build_operation_registry());

        let status_tool = tool_definitions
            .iter()
            .find(|tool| tool.name == "sendmock_status");

        assert_eq!(
            status_tool.map(|tool| tool.annotations),
            Some(McpToolAnnotations {
                read_only_hint: true,
                destructive_hint: false,
                idempotent_hint: false,
            })
        );
    }
}
