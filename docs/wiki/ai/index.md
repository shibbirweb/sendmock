---
title: AI
description: Let coding agents set up, test and extend SendMock through MCP and the CLI. Setup, what an agent can do, and the safety rules.
---

Every SendMock feature is an operation that the UI, the REST API, the CLI and the MCP server all share. So anything you can click, an AI coding agent (Claude Code, Codex, Cursor, Gemini CLI, VS Code agents and others) can do too, with the same checks: create a gateway, compose a flow, write a template, add a rule, read an OTP, replay a delivery.

## What an agent can do for you

- **Connect your app:** find the mail and SMS code in your repository, point it at SendMock, send a test.
- **Test a flow end to end:** trigger your app's sign-up, wait for the SMS, read the code, finish the sign-up.
- **Build what SendMock does not ship:** a payment gateway from its docs, a checkout flow, a webhook template for a provider, outcome rules, inbound routes, catcher responses. See [Build it with AI](./build-with-ai.md).
- **Debug:** read the latest failed delivery, explain the error, fix your handler, replay.
- **Keep it:** export the result to the seed file, or write a [scenario](../advanced/scenarios.md) that runs in CI.

## Set it up

SendMock not installed yet? Your agent can install it too: paste the prompt from [Install with AI](../install.md#install-with-ai).

Pick your agent, then run its command:

```bash tab="Claude Code" tab-group="agent"
sendmock ai install --target claude-code
```

```bash tab="Codex"
sendmock ai install --target codex
```

```bash tab="Cursor"
sendmock ai install --target cursor
```

```bash tab="Gemini CLI"
sendmock ai install --target gemini
```

```bash tab="VS Code"
sendmock ai install --target vscode
```

What the command does:

- Registers SendMock's MCP server with your agent.
- Installs the agent skill, or an instructions section for agents without skills.
- Writes them in your project for Claude Code, Cursor and VS Code, and in your user settings for Codex and Gemini CLI.
- Shows what it will change and asks first. Add `--yes` to write without asking.
- Without `--target`, it prints every agent's install command and MCP configuration, for any other agent.

### With npx or bunx (nothing installed)

If you run SendMock with [npx](../install.md#npx-no-install) or [bunx](../install.md#bunx-no-install), there is no `sendmock` on your `PATH`, so the agent starts SendMock through npx or bunx instead.

1. Set up your agent. Pick your agent in the tabs.

   With npx (needs [Node.js](https://nodejs.org)):

   ```bash tab="Claude Code" tab-group="agent"
   npx sendmock ai install --target claude-code
   ```

   ```bash tab="Codex"
   npx sendmock ai install --target codex
   ```

   ```bash tab="Cursor"
   npx sendmock ai install --target cursor
   ```

   ```bash tab="Gemini CLI"
   npx sendmock ai install --target gemini
   ```

   ```bash tab="VS Code"
   npx sendmock ai install --target vscode
   ```

   With bunx (needs [Bun](https://bun.sh)):

   ```bash tab="Claude Code" tab-group="agent"
   bunx sendmock ai install --target claude-code
   ```

   ```bash tab="Codex"
   bunx sendmock ai install --target codex
   ```

   ```bash tab="Cursor"
   bunx sendmock ai install --target cursor
   ```

   ```bash tab="Gemini CLI"
   bunx sendmock ai install --target gemini
   ```

   ```bash tab="VS Code"
   bunx sendmock ai install --target vscode
   ```

   This registers the MCP server and installs the agent skill, the same as the installed command does. The configuration it writes starts SendMock with `npx -y sendmock mcp`, so your agent needs Node.js even when you ran bunx. If you only have Bun, register the MCP server yourself as in step 2. From an installed SendMock, `sendmock ai install --npx` writes the same npx configuration.

2. Or register the MCP server yourself. Pick your agent; each example starts SendMock with npx:

   ```bash tab="Claude Code" tab-group="agent"
   claude mcp add sendmock -- npx -y sendmock mcp
   ```

   ```toml tab="Codex"
   # ~/.codex/config.toml
   [mcp_servers.sendmock]
   command = "npx"
   args = ["-y", "sendmock", "mcp"]
   ```

   ```jsonc tab="Cursor"
   // .cursor/mcp.json
   {
     "mcpServers": {
       "sendmock": {
         "command": "npx",
         "args": ["-y", "sendmock", "mcp"]
       }
     }
   }
   ```

   ```jsonc tab="Gemini CLI"
   // ~/.gemini/settings.json
   {
     "mcpServers": {
       "sendmock": {
         "command": "npx",
         "args": ["-y", "sendmock", "mcp"]
       }
     }
   }
   ```

   ```jsonc tab="VS Code"
   // .vscode/mcp.json
   {
     "servers": {
       "sendmock": {
         "type": "stdio",
         "command": "npx",
         "args": ["-y", "sendmock", "mcp"]
       }
     }
   }
   ```

   With Bun instead of Node.js, use the command `bunx` with the arguments `sendmock mcp`. In Claude Code:

   ```bash
   claude mcp add sendmock -- bunx sendmock mcp
   ```

3. On Windows, if your agent cannot start `npx` or `bunx` directly, put `cmd /c` in front: `cmd /c npx -y sendmock mcp`.

Settings > Connection > AI agents shows each agent's commands with the installed binary or npx: choose **npx (no install)** under **SendMock runs as**.

### Claude Code plugin

In Claude Code you can install the SendMock plugin instead.

- It carries the agent skill and registers the MCP server.
- Claude Code updates it with each SendMock release.
- Its MCP server runs `sendmock mcp`, so SendMock itself must be installed and on your `PATH`.

1. Add SendMock's plugin marketplace:

   ```text
   /plugin marketplace add shibbirweb/sendmock
   ```

2. Install the plugin:

   ```text
   /plugin install sendmock@sendmock
   ```

### Any other agent

Register SendMock's MCP server in your agent yourself.

1. Add an MCP server that runs this command (stdio):

   ```bash
   sendmock mcp
   ```

2. Make sure SendMock is running. The MCP server talks to the SendMock at `http://127.0.0.1:8025`.
   - Another address: add `--server <url>`.
   - No SendMock running: add `--embedded`, and the MCP server starts SendMock itself. It stops when your agent session ends, and takes its settings from the `SENDMOCK_*` variables and `sendmock.toml`.

Other ways to connect:

- **MCP over HTTP:** a running SendMock also serves MCP at `http://127.0.0.1:8025/mcp`.
- **The MCP registry:** from 1.0, clients that browse the official MCP registry find SendMock as `io.github.shibbirweb/sendmock`, run through the npm package or the Docker image.

Reference:

- [MCP reference](/mcp/): every tool, its inputs, an example call and what it returns.
- [CLI reference](/cli/): every command, the same way.

## Three ways in

| Surface | Best for |
| --- | --- |
| **MCP server** | agents that support MCP: typed tools, no shell parsing |
| **CLI** with `--json` | any agent with a shell, scripts, CI |
| **Agent skill** | teaching the agent when and how to use SendMock: workflows and safety rules |

Tool sets keep the agent's tool list small: the default is `core`, `email`, `sms`, `verify`, `extract` and `webhooks`; add `payments`, `templates`, `variables`, `http`, `logs`, `admin` or `scenario` with `sendmock mcp --toolsets ...`, or `--toolsets all`.

## Safety

- **Asks before destructive actions:** reset, delete-all and deleting definitions are marked destructive, so your agent asks you first. `sendmock mcp --read-only` exposes only read tools.
- **Never reads secrets back:** agents can set a secret (an auth token, a gateway's secret key) but every answer shows it masked.
- **Shows what the agent made:** endpoints, rules and definitions created through MCP or the CLI carry a small badge in the UI, so you can review them.
- **Stays local:** webhooks go to local URLs unless you ask for others, and release to real SMTP still needs your allowlist.

## Next

- [Build it with AI](./build-with-ai.md): prompts that work, for everything you can create.
- [Create a gateway with AI](./payment-gateway-with-ai.md): a complete worked example.
- [Built-in prompts](./prompts.md)
