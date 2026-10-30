use std::io::Read;

use clap::ArgMatches;
use sendmock_ops::{ErasedOperation, InputShape, ScalarType, build_input_from_text};
use serde_json::{Map, Value};

use crate::CliError;
use crate::command_arguments::{FlagInput, describe_command_inputs};

/// The operation's input from a parsed command line: `--data` or `--file` first, then the
/// positional arguments and flags on top, converted to the input's types.
pub fn build_command_input(
    operation: &dyn ErasedOperation,
    command_matches: &ArgMatches,
    level_matches: &[ArgMatches],
) -> Result<Value, CliError> {
    let command_inputs = describe_command_inputs(operation);
    let mut input = read_initial_input(operation, command_matches)?;
    let mut text_values: Vec<(String, String)> = Vec::new();
    for positional_input in &command_inputs.positional_inputs {
        let argument_value = level_matches
            .iter()
            .chain(std::iter::once(command_matches))
            .find_map(|matches| {
                matches
                    .try_get_one::<String>(&positional_input.input_name)
                    .ok()
                    .flatten()
                    .cloned()
            })
            .unwrap_or_default();
        if positional_input.reads_file {
            input.insert(
                positional_input.input_name.clone(),
                Value::String(read_text_file(&argument_value)?),
            );
        } else {
            text_values.push((positional_input.input_name.clone(), argument_value));
        }
    }
    for flag_input in &command_inputs.flag_inputs {
        text_values.extend(read_flag_values(flag_input, command_matches));
    }
    let input_schema = operation.input_schema().to_value();
    let typed_values = build_input_from_text(&input_schema, &text_values)
        .map_err(|operation_error| CliError::InvalidInput(operation_error.to_string()))?;
    input.extend(typed_values);
    Ok(Value::Object(input))
}

/// The raw body from `--file` (stdin by default) for raw-body operations, else `--data` or
/// the `--file` JSON.
fn read_initial_input(
    operation: &dyn ErasedOperation,
    command_matches: &ArgMatches,
) -> Result<Map<String, Value>, CliError> {
    let Some(raw_body_input) = operation.definition().raw_body_input else {
        return read_whole_body(command_matches);
    };
    let body_path = command_matches
        .try_get_one::<String>("file")
        .ok()
        .flatten()
        .map_or("-", String::as_str);
    let mut raw_input = Map::new();
    raw_input.insert(
        raw_body_input.input_name.to_owned(),
        Value::String(read_text_file(body_path)?),
    );
    Ok(raw_input)
}

/// One flag's values as text: a switch gives `true` or `false`, a list each repetition.
fn read_flag_values(flag_input: &FlagInput, command_matches: &ArgMatches) -> Vec<(String, String)> {
    let input_name = &flag_input.input_name;
    match flag_input.input_shape {
        InputShape::Scalar(ScalarType::Boolean) => {
            if command_matches.get_flag(input_name) {
                vec![(input_name.clone(), "true".to_owned())]
            } else if command_matches.get_flag(&format!("no-{}", flag_input.flag_name)) {
                vec![(input_name.clone(), "false".to_owned())]
            } else {
                Vec::new()
            }
        }
        InputShape::List(_) => command_matches
            .get_many::<String>(input_name)
            .into_iter()
            .flatten()
            .map(|list_value| (input_name.clone(), list_value.clone()))
            .collect(),
        InputShape::Scalar(_) | InputShape::Object => command_matches
            .get_one::<String>(input_name)
            .map(|flag_value| vec![(input_name.clone(), flag_value.clone())])
            .unwrap_or_default(),
    }
}

fn read_whole_body(command_matches: &ArgMatches) -> Result<Map<String, Value>, CliError> {
    let body_text = match (
        command_matches.try_get_one::<String>("data").ok().flatten(),
        command_matches.try_get_one::<String>("file").ok().flatten(),
    ) {
        (Some(data_text), _) => data_text.clone(),
        (None, Some(file_path)) => read_text_file(file_path)?,
        (None, None) => return Ok(Map::new()),
    };
    match serde_json::from_str(&body_text) {
        Ok(Value::Object(body_fields)) => Ok(body_fields),
        Ok(_) => Err(CliError::InvalidInput(
            "--data and --file take a JSON object".to_owned(),
        )),
        Err(parse_error) => Err(CliError::InvalidInput(format!(
            "The request body is not valid JSON: {parse_error}"
        ))),
    }
}

/// A file's text, or stdin for `-`.
fn read_text_file(file_path: &str) -> Result<String, CliError> {
    let unreadable = |read_error: std::io::Error| CliError::UnreadableFile {
        file_path: file_path.to_owned(),
        reason: read_error.to_string(),
    };
    if file_path == "-" {
        let mut stdin_text = String::new();
        std::io::stdin()
            .read_to_string(&mut stdin_text)
            .map_err(unreadable)?;
        return Ok(stdin_text);
    }
    std::fs::read_to_string(file_path).map_err(unreadable)
}

#[cfg(test)]
mod tests {
    use clap::Command;
    use serde_json::json;

    use super::*;
    use crate::test_operations::build_test_registry;
    use crate::{build_operation_commands, find_matched_operation};

    fn input_for(arguments: &[&str]) -> Result<Value, CliError> {
        let operation_registry = build_test_registry();
        let root_matches = Command::new("sendmock")
            .subcommands(build_operation_commands(&operation_registry))
            .try_get_matches_from(arguments)
            .map_err(|parse_error| CliError::InvalidInput(parse_error.to_string()))?;
        let matched_operation = find_matched_operation(&operation_registry, &root_matches)
            .ok_or_else(|| CliError::InvalidInput("no operation".to_owned()))?;
        build_command_input(
            matched_operation.operation.as_ref(),
            &matched_operation.command_matches,
            &matched_operation.level_matches,
        )
    }

    #[test]
    fn turns_flags_into_typed_input() -> Result<(), CliError> {
        let input = input_for(&[
            "sendmock", "test", "list", "--limit", "5", "--unread", "--tag", "a", "--tag", "b",
        ])?;

        assert_eq!(
            input,
            json!({ "limit": 5, "is_unread": true, "tags": ["a", "b"] })
        );
        Ok(())
    }

    #[test]
    fn a_negated_switch_sends_false() -> Result<(), CliError> {
        assert_eq!(
            input_for(&["sendmock", "test", "list", "--no-unread"])?,
            json!({ "is_unread": false })
        );
        Ok(())
    }

    #[test]
    fn takes_path_values_as_positional_arguments() -> Result<(), CliError> {
        assert_eq!(
            input_for(&["sendmock", "test", "delete", "01J0ITEM", "--yes"])?,
            json!({ "item_id": "01J0ITEM" })
        );
        Ok(())
    }

    #[test]
    fn a_wrongly_typed_flag_is_a_usage_error() {
        let input = input_for(&["sendmock", "test", "list", "--limit", "many"]);

        assert!(matches!(input, Err(CliError::InvalidInput(message)) if message.contains("limit")));
    }
}
