use std::process::ExitCode;

use clap::Command;
use sendmock_cli::{CommandDescription, describe_operation_commands};
use sendmock_mcp::build_tool_definitions;
use sendmock_ops::OperationRegistry;
use serde_json::json;

const BUILT_IN_COMMANDS: [(&str, &str); 5] = [
    (
        "sendmock serve",
        "Run the servers (the default when no command is given).",
    ),
    (
        "sendmock mcp",
        "Serve MCP over stdio for AI agents, with tools that call a running SendMock.",
    ),
    (
        "sendmock sendmail",
        "Hand a message on stdin to the SMTP listener, like sendmail (-t, -f); also works as a `sendmail` symlink.",
    ),
    (
        "sendmock version",
        "Print the version and release channel of this binary.",
    ),
    ("sendmock help", "Print help; `--all` lists every command."),
];

pub fn print_help(
    mut root_command: Command,
    operation_registry: &OperationRegistry,
    is_listing_all: bool,
    as_json: bool,
) -> ExitCode {
    if !is_listing_all {
        let _ = root_command.print_long_help();
        return ExitCode::SUCCESS;
    }
    let command_descriptions = describe_all_commands(operation_registry);
    if as_json {
        let command_tree = json!({
            "commands": command_descriptions,
            "mcp_tools": build_tool_definitions(operation_registry),
        });
        println!(
            "{}",
            serde_json::to_string_pretty(&command_tree).unwrap_or_default()
        );
    } else {
        for command_description in command_descriptions {
            println!(
                "{:<32} {}",
                command_description.usage, command_description.summary
            );
        }
    }
    ExitCode::SUCCESS
}

fn describe_all_commands(operation_registry: &OperationRegistry) -> Vec<CommandDescription> {
    let built_in_commands = BUILT_IN_COMMANDS
        .iter()
        .map(|(command, summary)| CommandDescription {
            command: (*command).to_owned(),
            usage: (*command).to_owned(),
            summary: (*summary).to_owned(),
            arguments: Vec::new(),
            flags: Vec::new(),
            operations: Vec::new(),
            mcp: Vec::new(),
        });
    built_in_commands
        .chain(describe_operation_commands(operation_registry))
        .collect()
}
