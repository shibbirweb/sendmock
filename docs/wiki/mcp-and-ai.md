---
title: MCP and AI
description: Let coding agents set up and test email, SMS and webhooks through MCP and the CLI.
---

> **MCP tools arrive alongside each backend phase; the agent skill and `sendmock ai install` arrive in Phase 4.**

SendMock is built so AI coding agents (Claude Code, Codex, Cursor, Gemini CLI and others) can drive it:

- an **MCP server** over stdio (and streamable HTTP in Phase 4) with toolsets for email, SMS, webhooks, templates and variables;
- the **CLI** with `--json` output;
- an **agent skill** that explains how to test messages with SendMock;
- `sendmock ai install` to register the MCP server and skill with your agent.

A typical agent session: check the server is up, trigger a sign-up in your app, wait for the SMS, read the code and finish the sign-up.
