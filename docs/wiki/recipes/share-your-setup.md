---
title: Share your setup
description: Export your endpoints, rules, templates, numbers and settings as a seed file, commit it, and give your team and CI the same SendMock.
---

> Works in your install from Phase 3 (the full seed file). Try it in the [demo](/demo/settings?section=seed) today.

**The situation:** you set up endpoints, rules, numbers and a Verify service. A teammate, and your CI, should start with exactly the same, and every test run should start clean.

## Steps

1. In **Settings > Seed**, press **Export sendmock.seed.toml**.
2. Put the file in your app's repository, next to your code, and commit it. Secrets are written as `${ENV_VAR}` references, never in plain text; set those variables on each machine.
3. Start SendMock with it: `sendmock --seed sendmock.seed.toml` (or mount it at `/config/sendmock.seed.toml` in Docker).
4. Before each test run, reset to it: **Settings > General > Reset to seed**, or `sendmock reset --yes`, or `POST /api/v1/reset`. Traffic is deleted and the configuration is the file's again.

## What you should see

On a teammate's machine, the same endpoints, rules, templates, variables (secrets from their environment), numbers, Messaging Services, Verify services, payment setup and settings.

## Try it in the demo

1. Open [Settings > Seed](/demo/settings?section=seed).
2. Press **Export sendmock.seed.toml**. The file downloads.

## Next

- [Advanced: seed file](../advanced/seed-file.md)
- [Configuration and seed file](../configuration.md)
