use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

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
}

const MCP_SERVERS_JSON: &str = "{\n  \"mcpServers\": {\n    \"sendmock\": {\n      \"command\": \"sendmock\",\n      \"args\": [\n        \"mcp\"\n      ]\n    }\n  }\n}";
const VSCODE_SERVERS_JSON: &str = "{\n  \"servers\": {\n    \"sendmock\": {\n      \"type\": \"stdio\",\n      \"command\": \"sendmock\",\n      \"args\": [\n        \"mcp\"\n      ]\n    }\n  }\n}";

fn build_setup(
    target: AiAgentTarget,
    name: &str,
    target_key: &str,
    (mcp_config_path, mcp_config): (&str, &str),
    instructions_path: &str,
) -> AiAgentSetup {
    AiAgentSetup {
        target,
        name: name.to_owned(),
        install_command: format!("sendmock ai install --target {target_key}"),
        mcp_config_path: mcp_config_path.to_owned(),
        mcp_config: mcp_config.to_owned(),
        instructions_path: instructions_path.to_owned(),
    }
}

/// Where each agent reads its MCP servers and instructions (docs/plan/14-ai-integration.md).
pub fn list_agent_setups() -> Vec<AiAgentSetup> {
    let claude_command = "claude mcp add sendmock -- sendmock mcp";
    vec![
        build_setup(
            AiAgentTarget::ClaudeCode,
            "Claude Code",
            "claude-code",
            (claude_command, claude_command),
            ".claude/skills/sendmock/",
        ),
        build_setup(
            AiAgentTarget::Codex,
            "Codex",
            "codex",
            (
                "~/.codex/config.toml",
                "[mcp_servers.sendmock]\ncommand = \"sendmock\"\nargs = [\"mcp\"]",
            ),
            "AGENTS.md",
        ),
        build_setup(
            AiAgentTarget::Cursor,
            "Cursor",
            "cursor",
            (".cursor/mcp.json", MCP_SERVERS_JSON),
            ".cursor/rules/sendmock.mdc",
        ),
        build_setup(
            AiAgentTarget::Gemini,
            "Gemini CLI",
            "gemini",
            ("~/.gemini/settings.json", MCP_SERVERS_JSON),
            "GEMINI.md",
        ),
        build_setup(
            AiAgentTarget::Vscode,
            "VS Code",
            "vscode",
            (".vscode/mcp.json", VSCODE_SERVERS_JSON),
            ".github/copilot-instructions.md",
        ),
    ]
}
