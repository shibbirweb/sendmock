import skillTemplate from "../../../../skill/sendmock/SKILL.md?raw";
import type { AiAgentSetup } from "@/lib/api/types";

type McpLaunch = { command: string; args: string[] };

const installedLaunch: McpLaunch = { command: "sendmock", args: ["mcp"] };
const npxLaunch: McpLaunch = {
  command: "npx",
  args: ["-y", "sendmock", "mcp"],
};

function renderServersJson(mcpLaunch: McpLaunch, isVscode: boolean): string {
  const sendmockServer = isVscode ? { type: "stdio", ...mcpLaunch } : mcpLaunch;
  const serversKey = isVscode ? "servers" : "mcpServers";
  return JSON.stringify(
    { [serversKey]: { sendmock: sendmockServer } },
    null,
    2,
  );
}

function renderCodexTable(mcpLaunch: McpLaunch): string {
  const quotedArguments = mcpLaunch.args
    .map((argument) => `"${argument}"`)
    .join(", ");
  return `[mcp_servers.sendmock]\ncommand = "${mcpLaunch.command}"\nargs = [${quotedArguments}]`;
}

function renderClaudeCodeCommand(mcpLaunch: McpLaunch): string {
  return `claude mcp add sendmock -- ${[mcpLaunch.command, ...mcpLaunch.args].join(" ")}`;
}

function buildSetup(
  setup: Pick<
    AiAgentSetup,
    "target" | "name" | "mcp_config_path" | "instructions_path"
  >,
  renderConfig: (mcpLaunch: McpLaunch) => string,
): AiAgentSetup {
  return {
    ...setup,
    install_command: `sendmock ai install --target ${setup.target}`,
    mcp_config: renderConfig(installedLaunch),
    npx_install_command: `npx sendmock ai install --target ${setup.target}`,
    npx_mcp_config: renderConfig(npxLaunch),
  };
}

/** How each AI agent connects, as `sendmock ai install` writes it, installed or through npx (docs/plan/14-ai-integration.md). */
export const aiAgentSetups: AiAgentSetup[] = [
  buildSetup(
    {
      target: "claude-code",
      name: "Claude Code",
      mcp_config_path: renderClaudeCodeCommand(installedLaunch),
      instructions_path: ".claude/skills/sendmock/",
    },
    renderClaudeCodeCommand,
  ),
  buildSetup(
    {
      target: "codex",
      name: "Codex",
      mcp_config_path: "~/.codex/config.toml",
      instructions_path: "AGENTS.md",
    },
    renderCodexTable,
  ),
  buildSetup(
    {
      target: "cursor",
      name: "Cursor",
      mcp_config_path: ".cursor/mcp.json",
      instructions_path: ".cursor/rules/sendmock.mdc",
    },
    (mcpLaunch) => renderServersJson(mcpLaunch, false),
  ),
  buildSetup(
    {
      target: "gemini",
      name: "Gemini CLI",
      mcp_config_path: "~/.gemini/settings.json",
      instructions_path: "GEMINI.md",
    },
    (mcpLaunch) => renderServersJson(mcpLaunch, false),
  ),
  buildSetup(
    {
      target: "vscode",
      name: "VS Code",
      mcp_config_path: ".vscode/mcp.json",
      instructions_path: ".github/copilot-instructions.md",
    },
    (mcpLaunch) => renderServersJson(mcpLaunch, true),
  ),
];

/** The skill the binary serves (skill/sendmock/SKILL.md), for the demo's version. */
export const agentSkillMarkdown = skillTemplate.replace(
  "{{sendmock_version}}",
  "0.0.0-dev",
);
