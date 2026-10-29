use sendmock_ops::{OperationRegistry, OperationSelector, SelectorChoice};
use serde::Serialize;

/// One command as `sendmock help --all --json` lists it, shaped like
/// `docs/api/cli-reference.json` so the two can be compared.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CommandDescription {
    pub command: String,
    pub usage: String,
    pub summary: String,
    pub arguments: Vec<String>,
    pub flags: Vec<String>,
    pub operations: Vec<OperationReference>,
    pub mcp: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct OperationReference {
    pub method: String,
    pub path: String,
    pub operation_id: String,
    pub selector: Option<SelectorReference>,
}

/// Written as the surface catalogue writes it: `{input, value}` or `{input, isGiven}`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SelectorReference {
    pub input: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(rename = "isGiven", skip_serializing_if = "Option::is_none")]
    pub is_given: Option<bool>,
}

impl From<OperationSelector> for SelectorReference {
    fn from(selector: OperationSelector) -> Self {
        let (value, is_given) = match selector.choice {
            SelectorChoice::Value(value) => (Some(value.to_owned()), None),
            SelectorChoice::Presence { is_given } => (None, Some(is_given)),
        };
        Self {
            input: selector.input_name.to_owned(),
            value,
            is_given,
        }
    }
}

pub fn describe_operation_commands(
    operation_registry: &OperationRegistry,
) -> Vec<CommandDescription> {
    operation_registry
        .operations()
        .iter()
        .map(|operation| {
            let definition = operation.definition();
            let command_inputs =
                crate::command_arguments::describe_command_inputs(operation.as_ref());
            CommandDescription {
                command: format!(
                    "sendmock {}",
                    crate::operation_commands::command_words(definition.cli_usage).join(" ")
                ),
                usage: definition.cli_usage.to_owned(),
                summary: definition.summary.to_owned(),
                arguments: command_inputs
                    .positional_inputs
                    .iter()
                    .map(|positional_input| positional_input.placeholder.clone())
                    .collect(),
                flags: command_inputs
                    .flag_inputs
                    .iter()
                    .map(|flag_input| format!("--{}", flag_input.flag_name))
                    .collect(),
                operations: vec![OperationReference {
                    method: definition.method.as_str().to_owned(),
                    path: definition.path.to_owned(),
                    operation_id: definition.operation_id.to_owned(),
                    selector: definition.selector.map(SelectorReference::from),
                }],
                mcp: vec![definition.mcp_tool.to_owned()],
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: AI-01.5
    #[test]
    fn describes_every_operation_command_with_its_operation_and_tool() {
        let command_descriptions =
            describe_operation_commands(&sendmock_ops::build_operation_registry());

        insta::assert_json_snapshot!(command_descriptions);
    }
}
