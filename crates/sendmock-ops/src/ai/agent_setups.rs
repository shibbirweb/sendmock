use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::mcp_launch::McpLaunch;

/// An AI agent `sendmock ai install` knows how to set up.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum AiAgentTarget {
    ClaudeCode,
    Codex,
    Cursor,
    Gemini,
    Vscode,
}

/// One item of `GET /api/v1/ai/agents`: how to connect an AI agent.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct AiAgentSetup {
    pub target: AiAgentTarget,
    pub name: String,
    pub install_command: String,
    /// Where the MCP configuration goes, e.g. `.cursor/mcp.json`.
    pub mcp_config_path: String,
    pub mcp_config: String,
    /// Where the skill or instructions go, e.g. `.claude/skills/sendmock/`.
    pub instructions_path: String,
    /// The install command for someone who runs SendMock through npx, with nothing installed.
    pub npx_install_command: String,
    /// The MCP configuration that starts SendMock with `npx -y sendmock mcp`.
    pub npx_mcp_config: String,
}

/// Where an agent reads its MCP servers, and how the configuration is written there.
#[derive(Debug, Clone, Copy)]
enum McpConfigFormat {
    ClaudeCodeCommand,
    CodexTable,
    /// JSON under `mcpServers`.
    McpServersJson,
    /// VS Code's JSON under `servers`, with `"type": "stdio"`.
    VscodeServersJson,
}

fn render_servers_json(mcp_launch: McpLaunch, servers_key: &str, type_line: &str) -> String {
    let argument_lines = mcp_launch
        .arguments()
        .iter()
        .map(|argument| format!("        \"{argument}\""))
        .collect::<Vec<_>>()
        .join(",\n");
    format!(
        "{{\n  \"{servers_key}\": {{\n    \"sendmock\": {{\n{type_line}      \"command\": \"{}\",\n      \"args\": [\n{argument_lines}\n      ]\n    }}\n  }}\n}}",
        mcp_launch.command()
    )
}

/// The configuration text shown for an agent, as `sendmock ai install` writes it.
fn render_mcp_config(config_format: McpConfigFormat, mcp_launch: McpLaunch) -> String {
    match config_format {
        McpConfigFormat::ClaudeCodeCommand => mcp_launch.claude_code_command(),
        McpConfigFormat::CodexTable => mcp_launch.codex_table().trim_end().to_owned(),
        McpConfigFormat::McpServersJson => render_servers_json(mcp_launch, "mcpServers", ""),
        McpConfigFormat::VscodeServersJson => {
            render_servers_json(mcp_launch, "servers", "      \"type\": \"stdio\",\n")
        }
    }
}

fn build_setup(
    (target, name, target_key): (AiAgentTarget, &str, &str),
    mcp_config_path: &str,
    config_format: McpConfigFormat,
    instructions_path: &str,
) -> AiAgentSetup {
    AiAgentSetup {
        target,
        name: name.to_owned(),
        install_command: McpLaunch::Installed.install_command(target_key),
        mcp_config_path: mcp_config_path.to_owned(),
        mcp_config: render_mcp_config(config_format, McpLaunch::Installed),
        instructions_path: instructions_path.to_owned(),
        npx_install_command: McpLaunch::Npx.install_command(target_key),
        npx_mcp_config: render_mcp_config(config_format, McpLaunch::Npx),
    }
}

/// Where each agent reads its MCP servers and instructions (docs/plan/14-ai-integration.md).
pub fn list_agent_setups() -> Vec<AiAgentSetup> {
    vec![
        build_setup(
            (AiAgentTarget::ClaudeCode, "Claude Code", "claude-code"),
            &McpLaunch::Installed.claude_code_command(),
            McpConfigFormat::ClaudeCodeCommand,
            ".claude/skills/sendmock/",
        ),
        build_setup(
            (AiAgentTarget::Codex, "Codex", "codex"),
            "~/.codex/config.toml",
            McpConfigFormat::CodexTable,
            "AGENTS.md",
        ),
        build_setup(
            (AiAgentTarget::Cursor, "Cursor", "cursor"),
            ".cursor/mcp.json",
            McpConfigFormat::McpServersJson,
            ".cursor/rules/sendmock.mdc",
        ),
        build_setup(
            (AiAgentTarget::Gemini, "Gemini CLI", "gemini"),
            "~/.gemini/settings.json",
            McpConfigFormat::McpServersJson,
            "GEMINI.md",
        ),
        build_setup(
            (AiAgentTarget::Vscode, "VS Code", "vscode"),
            ".vscode/mcp.json",
            McpConfigFormat::VscodeServersJson,
            ".github/copilot-instructions.md",
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn find_setup(target: AiAgentTarget) -> AiAgentSetup {
        list_agent_setups()
            .into_iter()
            .find(|setup| setup.target == target)
            .unwrap_or_else(|| panic!("no setup for {target:?}"))
    }

    #[test]
    fn the_installed_configurations_keep_their_shape() {
        assert_eq!(
            find_setup(AiAgentTarget::Cursor).mcp_config,
            "{\n  \"mcpServers\": {\n    \"sendmock\": {\n      \"command\": \"sendmock\",\n      \"args\": [\n        \"mcp\"\n      ]\n    }\n  }\n}"
        );
        assert_eq!(
            find_setup(AiAgentTarget::ClaudeCode).mcp_config,
            "claude mcp add sendmock -- sendmock mcp"
        );
    }

    // AC: AI-05.9
    #[test]
    fn every_agent_has_an_npx_install_command_and_configuration() {
        for setup in list_agent_setups() {
            assert!(
                setup
                    .npx_install_command
                    .starts_with("npx sendmock ai install --target ")
            );
            assert!(
                setup.npx_mcp_config.contains("npx"),
                "{}: {}",
                setup.name,
                setup.npx_mcp_config
            );
            let config_value: Result<serde_json::Value, _> =
                serde_json::from_str(&setup.npx_mcp_config);
            if let Ok(config_value) = config_value {
                let servers = config_value
                    .get("mcpServers")
                    .or_else(|| config_value.get("servers"));
                assert_eq!(
                    servers
                        .and_then(|servers| servers.get("sendmock"))
                        .and_then(|server| server.get("args")),
                    Some(&serde_json::json!(["-y", "sendmock", "mcp"]))
                );
            }
        }
        assert_eq!(
            find_setup(AiAgentTarget::Codex).npx_mcp_config,
            "[mcp_servers.sendmock]\ncommand = \"npx\"\nargs = [\"-y\", \"sendmock\", \"mcp\"]"
        );
    }
}
