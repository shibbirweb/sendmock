use sendmock_ops::OperationRegistry;
use serde::Serialize;

/// One command as `sendmock help --all --json` lists it, shaped like
/// `docs/api/cli-reference.json` so the two can be compared.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CommandDescription {
    pub command: String,
    pub usage: String,
    pub summary: String,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SelectorReference {
    pub input: String,
    pub value: String,
}

pub fn describe_operation_commands(
    operation_registry: &OperationRegistry,
) -> Vec<CommandDescription> {
    operation_registry
        .operations()
        .iter()
        .map(|operation| {
            let definition = operation.definition();
            CommandDescription {
                command: format!(
                    "sendmock {}",
                    crate::operation_commands::command_words(definition.cli_usage).join(" ")
                ),
                usage: definition.cli_usage.to_owned(),
                summary: definition.summary.to_owned(),
                operations: vec![OperationReference {
                    method: definition.method.as_str().to_owned(),
                    path: definition.path.to_owned(),
                    operation_id: definition.operation_id.to_owned(),
                    selector: definition.selector.map(|selector| SelectorReference {
                        input: selector.input_name.to_owned(),
                        value: selector.value.to_owned(),
                    }),
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
