---
title: AI
description: Let coding agents set up, test and extend SendMock through MCP and the CLI. Setup, what an agent can do, and the safety rules.
---

> MCP tools and CLI commands arrive with each backend phase (email in Phase 1, SMS in Phase 2, webhooks in Phase 3, payments in Phase 3P). The agent skill, the built-in prompts and `sendmock ai install` arrive in Phase 4.

Every SendMock feature is an operation that the UI, the REST API, the CLI and the MCP server all share. So anything you can click, an AI coding agent (Claude Code, Codex, Cursor, Gemini CLI, VS Code agents and others) can do too, with the same checks: create a gateway, compose a flow, write a template, add a rule, read an OTP, replay a delivery.

## What an agent can do for you

- **Connect your app:** find the mail and SMS code in your repository, point it at SendMock, send a test.
- **Test a flow end to end:** trigger your app's sign-up, wait for the SMS, read the code, finish the sign-up.
- **Build what SendMock does not ship:** a payment gateway from its docs, a checkout flow, a webhook template for a provider, outcome rules, inbound routes, catcher responses. See [Build it with AI](./build-with-ai.md).
- **Debug:** read the latest failed delivery, explain the error, fix your handler, replay.
- **Keep it:** export the result to the seed file, or write a [scenario](../advanced/scenarios.md) that runs in CI.

## Set it up

```bash
sendmock ai install --target claude-code     # or codex, cursor, gemini, vscode
```

It registers the MCP server with your agent and installs the agent skill (or an instructions section for agents without skills). It shows what it will change and asks first; `--scope project` writes to the repository instead of your user settings. `--target print` prints the snippets for any other agent.

Or register the MCP server yourself: the command is `sendmock mcp` (stdio). The running server also serves MCP over HTTP at `http://127.0.0.1:8025/mcp`.

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
