use std::sync::Arc;

use sendmock_ops::{ErasedOperation, OperationAnswer, OperationRegistry, SelectorChoice};
use serde_json::{Map, Value};

use crate::operation_runner::OperationRunner;
use crate::toolsets::ToolFilter;
use crate::{McpToolDefinition, build_tool_definitions};

/// What a tool call gave back, ready to be wrapped for the MCP client.
#[derive(Debug, Clone, PartialEq)]
pub enum ToolOutcome {
    Answer(OperationAnswer),
    Failure(String),
}

/// The tools one server exposes and the operations behind each.
pub struct McpToolCatalog {
    tools: Vec<(McpToolDefinition, Vec<Arc<dyn ErasedOperation>>)>,
    operation_runner: Arc<dyn OperationRunner>,
}

impl McpToolCatalog {
    pub fn new(
        operation_registry: &OperationRegistry,
        tool_filter: &ToolFilter,
        operation_runner: Arc<dyn OperationRunner>,
    ) -> Self {
        let tools = build_tool_definitions(operation_registry)
            .into_iter()
            .filter(|tool_definition| {
                tool_filter.allows(
                    &tool_definition.toolset,
                    tool_definition.annotations.read_only_hint,
                )
            })
            .map(|tool_definition| {
                let tool_operations = operation_registry
                    .operations()
                    .iter()
                    .filter(|operation| {
                        tool_definition
                            .operation_ids
                            .iter()
                            .any(|operation_id| operation_id == operation.definition().operation_id)
                    })
                    .cloned()
                    .collect();
                (tool_definition, tool_operations)
            })
            .collect();
        Self {
            tools,
            operation_runner,
        }
    }

    pub fn tool_definitions(&self) -> impl Iterator<Item = &McpToolDefinition> {
        self.tools
            .iter()
            .map(|(tool_definition, _)| tool_definition)
    }

    /// Runs the tool's operation; a tool behind several operations picks one by its selector
    /// argument, which is not passed on.
    pub async fn call_tool(&self, tool_name: &str, arguments: Map<String, Value>) -> ToolOutcome {
        let Some((_, tool_operations)) = self
            .tools
            .iter()
            .find(|(tool_definition, _)| tool_definition.name == tool_name)
        else {
            return ToolOutcome::Failure(format!("No tool named {tool_name}"));
        };
        let (selected_operation, input) = match select_operation(tool_operations, arguments) {
            Ok(selection) => selection,
            Err(selection_problem) => return ToolOutcome::Failure(selection_problem),
        };
        match self
            .operation_runner
            .run_operation(selected_operation, Value::Object(input))
            .await
        {
            Ok(operation_answer) => ToolOutcome::Answer(operation_answer),
            Err(failure_message) => ToolOutcome::Failure(failure_message),
        }
    }
}

/// The operation a tool call runs, with the input it gets.
type SelectedOperation = (Arc<dyn ErasedOperation>, Map<String, Value>);

fn select_operation(
    tool_operations: &[Arc<dyn ErasedOperation>],
    mut arguments: Map<String, Value>,
) -> Result<SelectedOperation, String> {
    if let [single_operation] = tool_operations {
        return Ok((Arc::clone(single_operation), arguments));
    }
    let Some(selector_input) = tool_operations
        .iter()
        .find_map(|operation| operation.definition().selector)
    else {
        return Err("The tool has no way to choose its operation".to_owned());
    };
    let is_input_given = arguments
        .get(selector_input.input_name)
        .is_some_and(|given_value| !given_value.is_null());
    let selected_value = match selector_input.choice {
        SelectorChoice::Value(_) => arguments
            .remove(selector_input.input_name)
            .and_then(|selector_value| selector_value.as_str().map(str::to_owned)),
        SelectorChoice::Presence { .. } => None,
    };
    let is_selected = |selector_choice: SelectorChoice| match selector_choice {
        SelectorChoice::Value(value) => selected_value.as_deref() == Some(value),
        SelectorChoice::Presence { is_given } => is_given == is_input_given,
    };
    tool_operations
        .iter()
        .find(|operation| {
            operation
                .definition()
                .selector
                .is_some_and(|selector| is_selected(selector.choice))
        })
        .map(|operation| (Arc::clone(operation), arguments))
        .ok_or_else(|| {
            format!(
                "{} must be one of the listed values",
                selector_input.input_name
            )
        })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn registered_operations(operation_ids: &[&str]) -> Vec<Arc<dyn ErasedOperation>> {
        sendmock_ops::build_operation_registry()
            .operations()
            .iter()
            .filter(|operation| operation_ids.contains(&operation.definition().operation_id))
            .cloned()
            .collect()
    }

    fn selected_operation_id(
        tool_operations: &[Arc<dyn ErasedOperation>],
        arguments: Value,
    ) -> Option<&'static str> {
        let Value::Object(arguments) = arguments else {
            return None;
        };
        select_operation(tool_operations, arguments)
            .ok()
            .map(|(operation, _)| operation.definition().operation_id)
    }

    #[test]
    fn the_upsert_tool_updates_when_the_id_is_given_and_creates_otherwise() {
        let upsert_operations = registered_operations(&["postNumbers", "patchNumbersByNumberId"]);

        assert_eq!(
            selected_operation_id(&upsert_operations, json!({ "number": "+15550001111" })),
            Some("postNumbers")
        );
        assert_eq!(
            selected_operation_id(&upsert_operations, json!({ "number_id": null })),
            Some("postNumbers")
        );
        assert_eq!(
            selected_operation_id(&upsert_operations, json!({ "number_id": "01JNUMBER" })),
            Some("patchNumbersByNumberId")
        );
    }

    #[test]
    fn a_value_selector_picks_by_its_value_and_is_not_passed_on() {
        let status_operations = registered_operations(&["getHealth", "getInfo"]);
        let Value::Object(arguments) = json!({ "view": "info" }) else {
            return;
        };

        let selection = select_operation(&status_operations, arguments);

        assert_eq!(
            selection
                .as_ref()
                .ok()
                .map(|(operation, input)| (operation.definition().operation_id, input.len())),
            Some(("getInfo", 0))
        );
    }
}
