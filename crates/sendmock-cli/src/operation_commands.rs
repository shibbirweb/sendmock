use std::collections::BTreeMap;
use std::sync::Arc;

use clap::{Arg, ArgMatches, Args, Command};
use sendmock_ops::{ErasedOperation, OperationRegistry};

use crate::ClientArguments;

const BINARY_NAME: &str = "sendmock";

/// A command line that names an operation, with the matches of its own subcommand.
pub struct MatchedOperation {
    pub operation: Arc<dyn ErasedOperation>,
    pub command_matches: ArgMatches,
}

#[derive(Default)]
struct CommandNode {
    operation: Option<Arc<dyn ErasedOperation>>,
    children: BTreeMap<&'static str, CommandNode>,
}

/// One subcommand per operation, nested by the words of its CLI usage
/// (`sendmock seed validate <file>` becomes `seed` > `validate`).
pub fn build_operation_commands(operation_registry: &OperationRegistry) -> Vec<Command> {
    build_command_tree(operation_registry)
        .children
        .into_iter()
        .map(|(command_name, command_node)| build_clap_command(command_name, command_node))
        .collect()
}

/// The operation a parsed command line names, if any.
pub fn find_matched_operation(
    operation_registry: &OperationRegistry,
    root_matches: &ArgMatches,
) -> Option<MatchedOperation> {
    let mut command_node = &build_command_tree(operation_registry);
    let mut current_matches = root_matches;
    while let Some((subcommand_name, subcommand_matches)) = current_matches.subcommand() {
        command_node = command_node.children.get(subcommand_name)?;
        current_matches = subcommand_matches;
    }
    command_node
        .operation
        .clone()
        .map(|operation| MatchedOperation {
            operation,
            command_matches: current_matches.clone(),
        })
}

/// The literal words of a usage after `sendmock`, without `<placeholders>`.
pub fn command_words(cli_usage: &'static str) -> Vec<&'static str> {
    cli_usage
        .split_whitespace()
        .skip_while(|word| *word == BINARY_NAME)
        .filter(|word| !word.starts_with('<'))
        .collect()
}

fn build_command_tree(operation_registry: &OperationRegistry) -> CommandNode {
    let mut root_node = CommandNode::default();
    for operation in operation_registry.operations() {
        let mut command_node = &mut root_node;
        for command_word in command_words(operation.definition().cli_usage) {
            command_node = command_node.children.entry(command_word).or_default();
        }
        command_node.operation = Some(Arc::clone(operation));
    }
    root_node
}

fn build_clap_command(command_name: &'static str, command_node: CommandNode) -> Command {
    let mut command = Command::new(command_name);
    if let Some(operation) = &command_node.operation {
        let definition = operation.definition();
        command = ClientArguments::augment_args(command.about(definition.summary));
        for cli_argument in definition.cli_arguments {
            command = command.arg(Arg::new(cli_argument.placeholder).required(true));
        }
    } else {
        command = command.subcommand_required(true);
    }
    command.subcommands(
        command_node
            .children
            .into_iter()
            .map(|(child_name, child_node)| build_clap_command(child_name, child_node)),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(arguments: &[&str]) -> Option<MatchedOperation> {
        let operation_registry = sendmock_ops::build_operation_registry();
        let root_command =
            Command::new(BINARY_NAME).subcommands(build_operation_commands(&operation_registry));
        let root_matches = root_command.try_get_matches_from(arguments).ok()?;
        find_matched_operation(&operation_registry, &root_matches)
    }

    #[test]
    fn reads_the_command_words_of_a_usage() {
        assert_eq!(
            command_words("sendmock seed validate <file>"),
            ["seed", "validate"]
        );
        assert_eq!(command_words("sendmock status"), ["status"]);
    }

    // AC: AI-01.1
    #[test]
    fn every_registered_operation_has_a_command() {
        let operation_registry = sendmock_ops::build_operation_registry();

        for operation in operation_registry.operations() {
            let mut arguments = vec![BINARY_NAME];
            arguments.extend(command_words(operation.definition().cli_usage));
            arguments.extend(
                operation
                    .definition()
                    .cli_arguments
                    .iter()
                    .map(|_| "argument-value"),
            );

            let matched_operation_id =
                parse(&arguments).map(|matched| matched.operation.definition().operation_id);

            assert_eq!(
                matched_operation_id,
                Some(operation.definition().operation_id)
            );
        }
    }

    #[test]
    fn a_command_takes_the_client_flags() {
        let matched = parse(&[
            "sendmock",
            "status",
            "--json",
            "--server",
            "http://sendmock:8025",
        ]);

        let server = matched
            .and_then(|matched| matched.command_matches.get_one::<String>("server").cloned());

        assert_eq!(server.as_deref(), Some("http://sendmock:8025"));
    }
}
