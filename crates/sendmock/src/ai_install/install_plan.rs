//! The files `sendmock ai install` writes for each agent, as the agents read them.

use std::path::{Path, PathBuf};

use sendmock_ops::ai::{AiAgentTarget, McpLaunch, SKILL_EXAMPLES};
use serde_json::json;

use super::config_merging::{merge_codex_toml, merge_json_server, merge_markdown_section};

/// One file to write: where, how to show it, and its new content.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedFile {
    pub path: PathBuf,
    pub new_text: String,
}

/// Where the files go: the project for project files, the home folder for user settings.
pub struct InstallPlaces<'places> {
    pub project_directory: &'places Path,
    pub home_directory: &'places Path,
}

/// The skill without its frontmatter, as instructions for agents that have no skills.
fn read_skill_body(skill_markdown: &str) -> &str {
    skill_markdown
        .strip_prefix("---\n")
        .and_then(|after_start| after_start.split_once("\n---\n"))
        .map_or(skill_markdown, |(_, skill_body)| skill_body)
        .trim_start()
}

fn read_existing(file_path: &Path) -> String {
    std::fs::read_to_string(file_path).unwrap_or_default()
}

fn plan_json_server(
    file_path: PathBuf,
    servers_key: &str,
    server_entry: serde_json::Value,
) -> PlannedFile {
    let new_text = merge_json_server(&read_existing(&file_path), servers_key, server_entry);
    PlannedFile {
        path: file_path,
        new_text,
    }
}

fn plan_markdown_section(file_path: PathBuf, skill_markdown: &str) -> PlannedFile {
    let new_text =
        merge_markdown_section(&read_existing(&file_path), read_skill_body(skill_markdown));
    PlannedFile {
        path: file_path,
        new_text,
    }
}

/// Claude Code reads the project's `.mcp.json` and the skill folder under `.claude/skills/`.
fn plan_claude_code(
    install_places: &InstallPlaces<'_>,
    skill_markdown: &str,
    mcp_launch: McpLaunch,
) -> Vec<PlannedFile> {
    let skill_directory = install_places
        .project_directory
        .join(".claude/skills/sendmock");
    let mut planned_files = vec![
        plan_json_server(
            install_places.project_directory.join(".mcp.json"),
            "mcpServers",
            mcp_launch.stdio_server_entry(),
        ),
        PlannedFile {
            path: skill_directory.join("SKILL.md"),
            new_text: skill_markdown.to_owned(),
        },
    ];
    planned_files.extend(
        SKILL_EXAMPLES
            .iter()
            .map(|(file_name, example_text)| PlannedFile {
                path: skill_directory.join("examples").join(file_name),
                new_text: (*example_text).to_owned(),
            }),
    );
    planned_files
}

fn plan_cursor_rule(install_places: &InstallPlaces<'_>, skill_markdown: &str) -> PlannedFile {
    let rule_text = format!(
        "---\ndescription: Test and debug email, SMS, payments and webhooks locally with SendMock.\nalwaysApply: false\n---\n\n{}",
        read_skill_body(skill_markdown)
    );
    PlannedFile {
        path: install_places
            .project_directory
            .join(".cursor/rules/sendmock.mdc"),
        new_text: rule_text,
    }
}

/// The MCP registration and the skill or instructions for one agent (AI-05.2), starting
/// SendMock the way `mcp_launch` says (AI-05.9).
pub fn plan_install(
    target: AiAgentTarget,
    install_places: &InstallPlaces<'_>,
    skill_markdown: &str,
    mcp_launch: McpLaunch,
) -> Vec<PlannedFile> {
    let stdio_server = mcp_launch.stdio_server_entry();
    let project_directory = install_places.project_directory;
    match target {
        AiAgentTarget::ClaudeCode => plan_claude_code(install_places, skill_markdown, mcp_launch),
        AiAgentTarget::Codex => {
            let config_path = install_places.home_directory.join(".codex/config.toml");
            let new_text =
                merge_codex_toml(&read_existing(&config_path), &mcp_launch.codex_table());
            vec![
                PlannedFile {
                    path: config_path,
                    new_text,
                },
                plan_markdown_section(project_directory.join("AGENTS.md"), skill_markdown),
            ]
        }
        AiAgentTarget::Cursor => vec![
            plan_json_server(
                project_directory.join(".cursor/mcp.json"),
                "mcpServers",
                stdio_server,
            ),
            plan_cursor_rule(install_places, skill_markdown),
        ],
        AiAgentTarget::Gemini => vec![
            plan_json_server(
                install_places.home_directory.join(".gemini/settings.json"),
                "mcpServers",
                stdio_server,
            ),
            plan_markdown_section(project_directory.join("GEMINI.md"), skill_markdown),
        ],
        AiAgentTarget::Vscode => vec![
            plan_json_server(
                project_directory.join(".vscode/mcp.json"),
                "servers",
                json!({
                    "type": "stdio",
                    "command": mcp_launch.command(),
                    "args": mcp_launch.arguments(),
                }),
            ),
            plan_markdown_section(
                project_directory.join(".github/copilot-instructions.md"),
                skill_markdown,
            ),
        ],
    }
}
