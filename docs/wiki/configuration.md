---
title: Configuration and seed file
description: sendmock.toml, environment variables and the sendmock.seed.toml seed file.
---

> **Server settings arrive in Phase 0; the seed file grows with each backend phase.** Settings > General and Settings > Seed in the [live demo](/demo/) show the screens.

## How SendMock runs: `sendmock.toml`

Ports, database path, auth, relay SMTP and retention. Precedence, highest first:

1. command-line flags
2. `SENDMOCK_*` environment variables
3. `sendmock.toml`
4. defaults

## What SendMock starts with: `sendmock.seed.toml`

Endpoints, rules, templates, variables, numbers, Messaging Services, Verify services and payment setup. **Reset to seed** in Settings (or `POST /api/v1/reset`) deletes all traffic and restores this file, so every test run starts from the same state.

- **Export** writes the current configuration as a seed file.
- **Validate** checks a file without applying it and lists errors with line numbers.
- **Apply** replaces the configuration with the file.

Secrets are never written to an export in plain text.

## Runtime settings

Retention, email and SMS options, opened events, chaos toggles and OTP patterns change at once from **Settings**, without a restart.
