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

/** The agent skill, as `sendmock ai skill --print` prints it (outline from docs/plan/14-ai-integration.md). */
export const agentSkillMarkdown = `---
name: sendmock
description: Test and debug email, SMS, payments and webhooks locally with SendMock.
---

# SendMock

Use SendMock when testing or debugging anything that sends email or SMS, takes payments, or receives provider webhooks locally.

1. Check it runs: \`sendmock status --json\` (MCP: \`sendmock_status\`). If not, start \`sendmock serve\` or ask the user.
2. Prefer the MCP tools; otherwise use the CLI with \`--json\`.
3. Workflows: connect an app, read an OTP, set up inbound webhooks with the right template, simulate outcomes, debug failed deliveries (check Logs first), complete Twilio Verify flows, add a payment gateway or flow, capture Slack and push calls with the HTTP catcher, write a scenario, export the setup with \`sendmock seed export\`.
4. Safety: never reset or delete everything without asking; never print secrets; keep webhooks on local URLs unless asked.
`;
