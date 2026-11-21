---
title: Configuration and seed file
description: sendmock.toml, environment variables and the sendmock.seed.toml seed file.
---

> Settings > General and Settings > Setup in the [live demo](/demo/) show the screens.

## How SendMock runs: `sendmock.toml`

Ports, database path, auth, relay SMTP and retention. Precedence, highest first:

1. command-line flags
2. `SENDMOCK_*` environment variables
3. `sendmock.toml`
4. defaults

Every flag, with its variable, key and default, is in [Configuration flags](./reference/configuration-flags.md).

## Choose what starts: the launcher

Run `sendmock` alone in a terminal and it asks which services to start: the web UI, REST API and MCP (always on), SMTP (always on), SMTPS, the provider APIs over HTTP and HTTPS, the HTTP Catcher's catch-all port and POP3, each with its address.

1. Tick the services with Space and press Enter.
2. Press Enter again on **Run**, or choose **Change ports** to edit each address (a port in use or chosen twice is named, with the next free one offered), **Reset to defaults** or **Cancel**.

SendMock saves the choice to `last-run.toml` in its config folder (next to `sendmock.toml`; `SENDMOCK_LAST_RUN_FILE` moves it) and prints the same start as a `sendmock serve` command for scripts. The next time, the list starts with that choice ticked, so Enter twice starts it again. The file holds addresses only, never secrets; a corrupt file or one from a newer SendMock is ignored with a warning.

SendMock asks only when you type `sendmock` alone with a terminal on both ends. With any command or option, in a pipe, with `CI` set, or with `--no-input` (`SENDMOCK_NO_INPUT=1`, which the Docker image sets) it asks nothing and starts as before.

Start without questions:

- the saved choice; flags given with it win for that run:

```bash
sendmock --last
```

- the saved choice for an agent's embedded SendMock:

```bash
sendmock mcp --embedded --last
```

- named services on their saved or default addresses (`smtp`, `smtps`, `provider`, `provider-tls`, `catcher`, `pop3`; `SENDMOCK_SERVICES` too):

```bash
sendmock --services smtp,catcher,pop3
```

See or clear the saved choice:

```bash
sendmock last-run
```

```bash
sendmock last-run clear
```

## What SendMock starts with: `sendmock.seed.toml`

Endpoints, rules, templates, variables, numbers, Messaging Services, Verify services and payment setup. **Reset to seed** in Settings (or `POST /api/v1/reset`) deletes all traffic and restores this file, so every test run starts from the same state.

- **Export** writes the current configuration as a seed file.
- **Validate** checks a file without applying it and lists errors with line numbers.
- **Apply** replaces the configuration with the file.

Secrets are never written to an export in plain text.

## Setup files: TOML, JSON or YAML, with a version

A setup file is a seed file with a `[sendmock]` header, written by **Settings > Setup > Export a setup** or `sendmock setup export`. SendMock reads it anywhere it reads a seed file, in any of the three formats, which hold the same structure:

```toml
[sendmock]
format = "sendmock.setup"
format_version = 2
exported_by = "1.3.0"
exported_at = "2026-11-20T10:00:00Z"
```

| Key | What it says |
| --- | --- |
| `format` | always `sendmock.setup` |
| `format_version` | the shape of the file; it changes only when a section or key changes, never in a patch release |
| `exported_by` | the SendMock version that wrote the file; a newer one with the same `format_version` is fine |
| `exported_at` | when it was written |

A file without the header is format 1, a seed file from before setups had versions, and still applies. An older format is upgraded for the import (your file stays as it is; `sendmock setup migrate` writes the upgraded copy), and a newer one is refused before anything changes. The versions are listed on [Docs versions](./versions.md#setup-file-format-versions).

The sections, each a list of items unless noted:

| Section | Holds | Items are matched by |
| --- | --- | --- |
| `[settings]` (a table) | the settings you changed from the defaults | |
| `[[projects]]` | projects | `key` |
| `[[webhook.endpoints]]`, `[[webhook.rules]]`, `[[webhook.saved]]` | webhook endpoints, rules and saved deliveries | `name` |
| `[[webhook.templates]]` | custom and edited webhook templates | `id` |
| `[[webhook.variables]]` | webhook variables | `endpoint` and `name` |
| `[[verify.services]]`, `[[messaging_services]]` | Verify services and Messaging Services | `sid` |
| `[[numbers]]` | virtual numbers | `number` |
| `[[sms.outcome_rules]]` | custom outcome numbers | `match` and `pattern` |
| `[[email.outcome_rules]]` | custom outcome addresses | `pattern` |
| `[[email.templates]]` | email template stand-ins | `id` |
| `[[email.tag_rules]]`, `[[email.forward_rules]]` | tag and forward rules | `name` |
| `[[email.inbound_routes]]` | inbound routes | `description` |
| `[[email.providers]]`, `[[sms.providers]]` | custom and edited providers | `key` |
| `[[payments.flows]]`, `[[payments.methods]]`, `[[payments.gateways]]` | payment flows, methods and gateways | `key` |
| `[[http.bins]]` | HTTP Catcher bins with their mock responses | `name` |
| `[[scenarios]]` | saved scenarios, with their `[[scenarios.steps]]` | `name` |

The JSON Schema of each format version is published at [`/schema/setup/v2.json`](/schema/setup/v2.json), so an editor checks a file as you write it. In JSON and YAML the sections nest under their group (`{"webhook": {"endpoints": [...]}}`).

Secrets are `${ENV_VAR}` references, read from the environment on import, or, with `--include-secrets`, text starting `encrypted:v1:` that only the export's passphrase opens. A setup never holds traffic or the options in `sendmock.toml` (ports, database path, auth), which belong to each machine.

## How much is kept: `--max-emails`, `--max-sms` and `--max-age`

SendMock keeps the newest messages and deletes older ones automatically, within a few seconds of a limit being reached.

| Limit | Flag | Variable | `sendmock.toml` | Default |
| --- | --- | --- | --- | --- |
| Emails | `--max-emails` | `SENDMOCK_MAX_EMAILS` | `max_emails` | 1,000 |
| SMS | `--max-sms` | `SENDMOCK_MAX_SMS` | `max_sms` | 1,000 |
| Age | `--max-age` (such as `7d`) | `SENDMOCK_MAX_AGE` | `max_age` | none: kept until a count limit is reached |

What each limit covers:

- **Emails:** emails with their SMTP sessions, logged API requests, HTTP catcher requests and finished webhook deliveries. Each keeps its own newest count.
- **SMS:** SMS (with WhatsApp media), verifications and push notifications.
- **Age:** every kind of traffic above.
- **Never deleted:** configuration (endpoints, rules, templates, variables, numbers, providers, saved deliveries), deliveries still waiting to be sent, and payments.

Each count limit takes 0 to 1,000,000. Settings > General > Retention changes them at once, without a restart.

### No limit

Set a count limit to `0` to keep every email or every SMS:

```bash
sendmock --max-emails 0 --max-sms 0
```

Use it with care:

- With no age limit either, nothing stops the database growing until the disk is full, and lists and searches slow down as it grows.
- SendMock warns in its log at startup, and Settings shows a warning, while that is so.
- A fixed limit is recommended for disk and memory safety. To keep everything for a while, add an age limit instead, such as `--max-age 30d`.

## The catch-all catcher port: `--catcher-addr`

`--catcher-addr 127.0.0.1:8030` (or `SENDMOCK_CATCHER_ADDR`, or `catcher_addr` in `sendmock.toml`) starts a port where every request is captured by the HTTP catcher, at any path, the first path segment naming the bin. It is off unless set. See [Catch every path on its own port](./http/index.md#catch-every-path-on-its-own-port).

## Read the mail over POP3: `--pop3-addr`

`--pop3-addr 127.0.0.1:1110` (or `SENDMOCK_POP3_ADDR`, or `pop3_addr` in `sendmock.toml`) starts a POP3 server, so a mail client, a support-inbox feature that polls a mailbox, or a script built on a POP3 library can read the mail SendMock caught. It is off unless set.

1. Start SendMock with POP3 on:

   ```bash
   sendmock --pop3-addr 127.0.0.1:1110
   ```

2. Point the client at host `127.0.0.1`, port `1110`, without TLS.
3. Sign in. The username picks the mailbox: a [project's](./settings.md#projects) key reads that project, any other name reads Default. Any password works, unless SendMock was started with `--pop3-auth file:<path>` (`SENDMOCK_POP3_AUTH`), which admits only the `user:password` lines of that file, as `--smtp-auth` does.

The mailbox holds the newest 100 emails, oldest first, fixed when you sign in. **RETR** gives each message exactly as SendMock received it and **UIDL** its email id. Messages a client deletes are deleted from SendMock when it sends **QUIT**, as **Delete** in Mail would; a client that disconnects without QUIT deletes nothing. Settings > Connection shows the POP3 port while it is on. In Docker, set `SENDMOCK_POP3_ADDR=0.0.0.0:1110` and publish the port.

## Sample data: `--demo`

`sendmock --demo` (or `SENDMOCK_DEMO=1`) fills an empty instance at startup with the sample data of the [live demo](/demo/): emails, SMS conversations, a verification, webhook endpoints and rules, HTTP catcher bins and payments. Each item goes through the same API call your app or the UI would make, so events fire and rules deliver; the demo's endpoints post to SendMock's own catcher, so nothing leaves your machine. When the instance already holds data, `--demo` adds nothing and says so in the log.

## Template files: `--templates-dir`

Keep webhook templates in your repository as files. Point `--templates-dir` (or `SENDMOCK_TEMPLATES_DIR`) at a folder of `.toml` template files, in the format **Export** writes from Webhooks > Templates. SendMock loads them at startup and again within two seconds whenever a file is added, changed or removed. They show in the gallery as **File** templates, and endpoints can use them like any other; to change one, edit its file (SendMock refuses edits and deletes with `409`). A file without an `id` gets `file.<file name>`; a file that does not parse is skipped and named in the log.

## Runtime settings

Retention, email and SMS options, opened events, chaos toggles and OTP patterns change at once from **Settings**, without a restart. Each section is explained in [Settings](./settings.md); the seed file in depth is [Advanced: seed file](./advanced/seed-file.md).
