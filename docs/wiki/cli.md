---
title: CLI
description: Every SendMock operation from the terminal, with JSON output for scripts.
---

> **The CLI grows with each backend phase: `status` in Phase 0, email in Phase 1, SMS in Phase 2, webhooks in Phase 3.**

The same `sendmock` binary is the CLI. Every operation available in the UI and the REST API has a command, and `--json` prints machine-readable output with stable exit codes.

```bash
sendmock status --json
sendmock otp --to +8801700000000 --wait 10s
sendmock email list --to user@example.test
```

Every menu page ends with a **From the CLI, API and AI** table listing the commands for that screen, starting with [Mail](./mail/index.md). The [Advanced](./advanced/index.md) pages show complete examples, and [Scenarios](./advanced/scenarios.md) chain commands into a repeatable test.
