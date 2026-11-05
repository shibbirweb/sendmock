import skillTemplate from "../../../../skill/sendmock/SKILL.md?raw";
import type { AiAgentSetup } from "@/lib/api/types";

const mcpServerJson = JSON.stringify(
  { mcpServers: { sendmock: { command: "sendmock", args: ["mcp"] } } },
  null,
  2,
);

/** How each AI agent connects, as `sendmock ai install` writes it (docs/plan/14-ai-integration.md). */
export const aiAgentSetups: AiAgentSetup[] = [
  {
    target: "claude-code",
    name: "Claude Code",
    install_command: "sendmock ai install --target claude-code",
    mcp_config_path: "claude mcp add sendmock -- sendmock mcp",
    mcp_config: "claude mcp add sendmock -- sendmock mcp",
    instructions_path: ".claude/skills/sendmock/",
  },
  {
    target: "codex",
    name: "Codex",
    install_command: "sendmock ai install --target codex",
    mcp_config_path: "~/.codex/config.toml",
    mcp_config: '[mcp_servers.sendmock]\ncommand = "sendmock"\nargs = ["mcp"]',
    instructions_path: "AGENTS.md",
  },
  {
    target: "cursor",
    name: "Cursor",
    install_command: "sendmock ai install --target cursor",
    mcp_config_path: ".cursor/mcp.json",
    mcp_config: mcpServerJson,
    instructions_path: ".cursor/rules/sendmock.mdc",
  },
  {
    target: "gemini",
    name: "Gemini CLI",
    install_command: "sendmock ai install --target gemini",
    mcp_config_path: "~/.gemini/settings.json",
    mcp_config: mcpServerJson,
    instructions_path: "GEMINI.md",
  },
  {
    target: "vscode",
    name: "VS Code",
    install_command: "sendmock ai install --target vscode",
    mcp_config_path: ".vscode/mcp.json",
    mcp_config: JSON.stringify(
      {
        servers: {
          sendmock: { type: "stdio", command: "sendmock", args: ["mcp"] },
        },
      },
      null,
      2,
    ),
    instructions_path: ".github/copilot-instructions.md",
  },
];

/** The skill the binary serves (skill/sendmock/SKILL.md), for the demo's version. */
export const agentSkillMarkdown = skillTemplate.replace(
  "{{sendmock_version}}",
  "0.0.0-dev",
);
