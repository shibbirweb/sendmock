use std::collections::BTreeMap;
use std::sync::Arc;

use clap::{Arg, ArgMatches, Args, Command};
use sendmock_ops::{ErasedOperation, OperationRegistry, to_snake_case};

use crate::ClientArguments;

const BINARY_NAME: &str = "sendmock";

/// A command line that names an operation, with the matches of every level of its command,
/// outermost first; a positional value may sit on any of them.
pub struct MatchedOperation {
    pub operation: Arc<dyn ErasedOperation>,
    pub command_matches: ArgMatches,
    pub level_matches: Vec<ArgMatches>,
}

#[derive(Default)]
struct CommandNode {
    operation: Option<Arc<dyn ErasedOperation>>,
    /// Placeholders written before a later command word, such as `<emailId>` in
    /// `sendmock email check <emailId> unsubscribe`, taken by this level.
    level_placeholders: Vec<&'static str>,
    children: BTreeMap<&'static str, CommandNode>,
}

/// A usage's words up to its first flag: command words and `<placeholders>`, in order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UsageSegment {
    CommandWord(&'static str),
    Placeholder(&'static str),
}

pub fn usage_segments(cli_usage: &'static str) -> Vec<UsageSegment> {
    cli_usage
        .split_whitespace()
        .skip_while(|word| *word == BINARY_NAME)
        .take_while(|word| !word.starts_with("--") && !word.starts_with('['))
        .map(|word| {
            match word
                .strip_prefix('<')
                .and_then(|rest| rest.strip_suffix('>'))
            {
                Some(placeholder) => UsageSegment::Placeholder(placeholder),
                None => UsageSegment::CommandWord(word),
            }
        })
        .collect()
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
    let mut level_matches = Vec::new();
    while let Some((subcommand_name, subcommand_matches)) = current_matches.subcommand() {
        command_node = command_node.children.get(subcommand_name)?;
        current_matches = subcommand_matches;
        level_matches.push(subcommand_matches.clone());
    }
    command_node
        .operation
        .clone()
        .map(|operation| MatchedOperation {
            operation,
            command_matches: current_matches.clone(),
            level_matches,
        })
}

/// The command words of a usage: `sendmock email check <emailId> unsubscribe` gives
/// `email check unsubscribe`, `sendmock otp --to <recipient>` gives `otp`.
pub fn command_words(cli_usage: &'static str) -> Vec<&'static str> {
    usage_segments(cli_usage)
        .into_iter()
        .filter_map(|segment| match segment {
            UsageSegment::CommandWord(command_word) => Some(command_word),
            UsageSegment::Placeholder(_) => None,
        })
        .collect()
}

fn build_command_tree(operation_registry: &OperationRegistry) -> CommandNode {
    let mut root_node = CommandNode::default();
    for operation in operation_registry.operations() {
        let segments = usage_segments(operation.definition().cli_usage);
        let last_word_position = segments
            .iter()
            .rposition(|segment| matches!(segment, UsageSegment::CommandWord(_)));
        let mut command_node = &mut root_node;
        for (segment_position, segment) in segments.iter().enumerate() {
            match segment {
                UsageSegment::CommandWord(command_word) => {
                    command_node = command_node.children.entry(command_word).or_default();
                }
                UsageSegment::Placeholder(placeholder) => {
                    let is_before_a_command_word =
                        last_word_position.is_some_and(|position| segment_position < position);
                    if is_before_a_command_word
                        && !command_node.level_placeholders.contains(placeholder)
                    {
                        command_node.level_placeholders.push(placeholder);
                    }
                }
            }
        }
        command_node.operation = Some(Arc::clone(operation));
    }
    root_node
}

fn build_clap_command(command_name: &'static str, command_node: CommandNode) -> Command {
    let mut command = Command::new(command_name);
    for placeholder in &command_node.level_placeholders {
        command = command.arg(
            Arg::new(to_snake_case(placeholder))
                .value_name(*placeholder)
                .required(true),
        );
    }
    if let Some(operation) = &command_node.operation {
        command = ClientArguments::augment_args(command).about(operation.definition().summary);
        command = crate::command_arguments::add_operation_arguments(command, operation.as_ref());
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
        assert_eq!(command_words("sendmock otp --to <recipient>"), ["otp"]);
    }

    // AC: AI-01.1
    #[test]
    fn every_registered_operation_has_a_command() {
        let operation_registry = sendmock_ops::build_operation_registry();
        let root_command =
            Command::new(BINARY_NAME).subcommands(build_operation_commands(&operation_registry));

        for operation in operation_registry.operations() {
            let cli_usage = operation.definition().cli_usage;
            let found_command = command_words(cli_usage)
                .into_iter()
                .try_fold(&root_command, |command, command_word| {
                    command.find_subcommand(command_word)
                });

            assert!(found_command.is_some(), "no command for {cli_usage}");
        }
    }

    #[test]
    fn a_command_is_described_by_its_operation_summary() {
        let operation_registry = sendmock_ops::build_operation_registry();
        let root_command =
            Command::new(BINARY_NAME).subcommands(build_operation_commands(&operation_registry));

        let validate_about = root_command
            .find_subcommand("seed")
            .and_then(|seed_command| seed_command.find_subcommand("validate"))
            .and_then(Command::get_about)
            .map(ToString::to_string);

        assert_eq!(
            validate_about.as_deref(),
            Some("Check a seed file without applying it.")
        );
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
