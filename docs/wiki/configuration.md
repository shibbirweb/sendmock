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

## The catch-all catcher port: `--catcher-addr`

`--catcher-addr 127.0.0.1:8030` (or `SENDMOCK_CATCHER_ADDR`, or `catcher_addr` in `sendmock.toml`) starts a port where every request is captured by the HTTP catcher, at any path, the first path segment naming the bin. It is off unless set. See [Catch every path on its own port](./http/index.md#catch-every-path-on-its-own-port).

## Sample data: `--demo`

`sendmock --demo` (or `SENDMOCK_DEMO=1`) fills an empty instance at startup with the sample data of the [live demo](/demo/): emails, SMS conversations, a verification, webhook endpoints and rules, HTTP catcher bins and payments. Each item goes through the same API call your app or the UI would make, so events fire and rules deliver; the demo's endpoints post to SendMock's own catcher, so nothing leaves your machine. When the instance already holds data, `--demo` adds nothing and says so in the log.

## Template files: `--templates-dir`

Keep webhook templates in your repository as files. Point `--templates-dir` (or `SENDMOCK_TEMPLATES_DIR`) at a folder of `.toml` template files, in the format **Export** writes from Webhooks > Templates. SendMock loads them at startup and again within two seconds whenever a file is added, changed or removed. They show in the gallery as **File** templates, and endpoints can use them like any other; to change one, edit its file (SendMock refuses edits and deletes with `409`). A file without an `id` gets `file.<file name>`; a file that does not parse is skipped and named in the log.

## Runtime settings

Retention, email and SMS options, opened events, chaos toggles and OTP patterns change at once from **Settings**, without a restart. Each section is explained in [Settings](./settings.md); the seed file in depth is [Advanced: seed file](./advanced/seed-file.md).
