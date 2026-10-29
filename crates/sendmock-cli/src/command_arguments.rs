use clap::{Arg, ArgAction, Command};
use sendmock_ops::{
    AnswerKind, ErasedOperation, InputShape, OperationDefinition, ScalarType, accepts_null,
    describe_input_shape, to_snake_case,
};
use serde_json::Value;

use crate::flag_naming::build_flag_name;
use crate::operation_commands::{UsageSegment, usage_segments};

/// Flags every client command already has, which an input may not take over.
const RESERVED_FLAG_NAMES: [&str; 8] = [
    "server", "token", "json", "data", "file", "yes", "output", "help",
];

/// One positional argument, in the order the usage names it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PositionalInput {
    pub is_on_this_level: bool,
    pub placeholder: String,
    pub input_name: String,
    pub reads_file: bool,
}

/// One flag and the input it fills.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FlagInput {
    pub input_name: String,
    pub flag_name: String,
    pub input_shape: InputShape,
    pub is_required: bool,
}

/// How a command's command line maps to its operation's input.
#[derive(Debug, Clone, Default)]
pub struct CommandInputs {
    pub positional_inputs: Vec<PositionalInput>,
    pub flag_inputs: Vec<FlagInput>,
}

pub fn describe_command_inputs(operation: &dyn ErasedOperation) -> CommandInputs {
    let definition = operation.definition();
    let positional_inputs = describe_positional_inputs(definition);
    let input_schema = operation.input_schema().to_value();
    let raw_body_name = definition
        .raw_body_input
        .map(|raw_body| raw_body.input_name);
    let flag_inputs = input_schema["properties"]
        .as_object()
        .into_iter()
        .flatten()
        .filter(|(input_name, _)| {
            Some(input_name.as_str()) != raw_body_name
                && !positional_inputs
                    .iter()
                    .any(|positional| &positional.input_name == *input_name)
        })
        .map(|(input_name, property_schema)| {
            describe_flag_input(definition, &input_schema, input_name, property_schema)
        })
        .filter(|flag_input| !RESERVED_FLAG_NAMES.contains(&flag_input.flag_name.as_str()))
        .collect();
    CommandInputs {
        positional_inputs,
        flag_inputs,
    }
}

/// The `<placeholders>` of the usage that are not a flag's value, in order.
fn describe_positional_inputs(definition: &OperationDefinition) -> Vec<PositionalInput> {
    let segments = usage_segments(definition.cli_usage);
    let last_word_position = segments
        .iter()
        .rposition(|segment| matches!(segment, UsageSegment::CommandWord(_)));
    segments
        .iter()
        .enumerate()
        .filter_map(|(segment_position, segment)| match segment {
            UsageSegment::Placeholder(placeholder) => Some((segment_position, *placeholder)),
            UsageSegment::CommandWord(_) => None,
        })
        .map(|(segment_position, placeholder)| {
            let file_argument = definition
                .cli_arguments
                .iter()
                .find(|argument| argument.placeholder == placeholder);
            PositionalInput {
                is_on_this_level: last_word_position
                    .is_none_or(|position| segment_position > position),
                placeholder: placeholder.to_owned(),
                input_name: file_argument.map_or_else(
                    || to_snake_case(placeholder),
                    |argument| argument.input_name.to_owned(),
                ),
                reads_file: file_argument.is_some_and(|argument| argument.reads_file),
            }
        })
        .collect()
}

fn describe_flag_input(
    definition: &OperationDefinition,
    input_schema: &Value,
    input_name: &str,
    property_schema: &Value,
) -> FlagInput {
    let input_shape = describe_input_shape(property_schema, input_schema);
    let renamed_flag = definition
        .cli_flag_names
        .iter()
        .find(|(renamed_input, _)| *renamed_input == input_name)
        .map(|(_, flag_name)| (*flag_name).to_owned());
    FlagInput {
        input_name: input_name.to_owned(),
        flag_name: renamed_flag.unwrap_or_else(|| build_flag_name(input_name, input_shape)),
        input_shape,
        is_required: !accepts_null(property_schema)
            && input_schema["required"]
                .as_array()
                .is_some_and(|required_names| required_names.iter().any(|name| name == input_name)),
    }
}

/// Adds the operation's arguments and flags to its command.
pub fn add_operation_arguments(mut command: Command, operation: &dyn ErasedOperation) -> Command {
    let definition = operation.definition();
    let command_inputs = describe_command_inputs(operation);
    let input_schema = operation.input_schema().to_value();
    for positional_input in command_inputs
        .positional_inputs
        .iter()
        .filter(|positional| positional.is_on_this_level)
    {
        command = command.arg(
            Arg::new(positional_input.input_name.clone())
                .value_name(positional_input.placeholder.clone())
                .required(true),
        );
    }
    for flag_input in &command_inputs.flag_inputs {
        let help_text = input_schema
            .pointer(&format!(
                "/properties/{}/description",
                flag_input.input_name
            ))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();
        command = add_flag(command, flag_input, help_text);
    }
    add_confirmation_flags(add_body_and_answer_flags(command, definition), definition)
}

/// `--yes` for destructive commands, `--reveal` for commands that answer a secret.
fn add_confirmation_flags(
    mut command: Command,
    definition: &sendmock_ops::OperationDefinition,
) -> Command {
    if definition.is_destructive {
        command = command.arg(
            Arg::new("yes")
                .long("yes")
                .action(ArgAction::SetTrue)
                .help("Confirm; destructive commands never run without it"),
        );
    }
    if definition.revealed_secret_field.is_some() {
        command = command.arg(
            Arg::new("reveal")
                .long("reveal")
                .action(ArgAction::SetTrue)
                .help("Prints the secret in plain text instead of masked"),
        );
    }
    command
}

/// `--data` and `--file` for JSON bodies, `--output` for files.
fn add_body_and_answer_flags(
    mut command: Command,
    definition: &sendmock_ops::OperationDefinition,
) -> Command {
    if matches!(
        definition.method,
        sendmock_ops::HttpMethod::Post
            | sendmock_ops::HttpMethod::Put
            | sendmock_ops::HttpMethod::Patch
    ) && definition.raw_body_input.is_none()
    {
        command = command
            .arg(
                Arg::new("data")
                    .long("data")
                    .value_name("JSON")
                    .help("The whole request body as JSON; flags override its keys"),
            )
            .arg(
                Arg::new("file")
                    .long("file")
                    .value_name("PATH")
                    .help("Read the request body from a JSON file, or stdin with -"),
            );
    }
    if definition.raw_body_input.is_some() {
        command = command.arg(
            Arg::new("file")
                .long("file")
                .value_name("PATH")
                .help("Read the body from this file, or stdin with - (the default)"),
        );
    }
    if let AnswerKind::File { .. } = definition.answer_kind {
        command = command.arg(
            Arg::new("output")
                .long("output")
                .short('o')
                .value_name("PATH")
                .help("Write the file here instead of to stdout"),
        );
    }
    command
}

fn add_flag(command: Command, flag_input: &FlagInput, help_text: String) -> Command {
    match flag_input.input_shape {
        InputShape::Scalar(ScalarType::Boolean) => {
            let negated_flag_name = format!("no-{}", flag_input.flag_name);
            command
                .arg(
                    Arg::new(flag_input.input_name.clone())
                        .long(flag_input.flag_name.clone())
                        .action(ArgAction::SetTrue)
                        .help(help_text),
                )
                .arg(
                    Arg::new(negated_flag_name.clone())
                        .long(negated_flag_name)
                        .action(ArgAction::SetTrue)
                        .conflicts_with(flag_input.input_name.clone())
                        .hide(true),
                )
        }
        InputShape::List(_) => command.arg(
            Arg::new(flag_input.input_name.clone())
                .long(flag_input.flag_name.clone())
                .action(ArgAction::Append)
                .help(help_text),
        ),
        InputShape::Scalar(_) | InputShape::Object => command.arg(
            Arg::new(flag_input.input_name.clone())
                .long(flag_input.flag_name.clone())
                .required(flag_input.is_required)
                .help(help_text),
        ),
    }
}
