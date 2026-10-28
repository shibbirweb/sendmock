# 25. Phase 1: email backend and the first beta

Phase 1 makes email real: apps send over SMTP, `sendmail` or the native HTTP API, SendMock stores and parses every message, and the Mail, Logs and Settings screens switch to live data. It ends with everything the first beta, `0.1.0-beta.1`, needs ([11](11-roadmap.md#phase-1-email-backend-about-2-3-weeks)).

## Goal and done-when

**Done when** (from [11](11-roadmap.md#phase-1-email-backend-about-2-3-weeks)): a Laravel app and a Node app both send mail that appears live in the UI, and a pytest test reads an OTP through `/api/v1/otp`. In full:

- every Phase 1 item in [PROGRESS.md](PROGRESS.md) is ticked and the criteria below have passing tests that name them;
- the binary embeds the live UI build; Mail, Logs and Settings work on real data, and every operation not built yet shows Not available yet (UI-12);
- the cross-language SMTP job sends from the example apps and reads the messages back through the API;
- the release build makes `.deb` and `.rpm` packages and the Docker `beta` tags, ready for the owner to run Prepare release with `bump: minor` after the merge.

Publishing `0.1.0-beta.1` is the owner's step after the branch merges into `develop`: Prepare release runs from `develop` only.

## Workstreams and order

All on `feat/phase-0`, with a commit per workstream, as the owner asked on 2026-10-29 (every phase on this branch).

| # | Workstream | Criteria | Depends on |
|---|------------|----------|------------|
| W1 | Operation framework: path parameters, typed query parameters, 201 and 204 answers, file answers and raw bodies, CLI flags and MCP inputs from the input schema | AI-01.4 | |
| W2 | Email storage and parsing: schema, `EmailRepository`, MIME parsing, raw zstd, BCC, extractors, tags, retention | EM-03, EM-05.1 to EM-05.3, EM-12.1, EM-12.2, PL-08 | W1 |
| W3 | Email operations: list and search, detail, latest, update, delete, raw, attachments, MIME, timeline, List-Unsubscribe, `otp`, `links`, `wait/email`, native send and `send/raw` | EM-04.5, EM-04.6, EM-05.4, EM-07, EM-12.4, EM-13.4, PL-03.1 to PL-03.3 (email) | W2 |
| W4 | SMTP server: session state machine, extensions, SIZE, STARTTLS and SMTPS with a generated certificate, AUTH modes, require-TLS, recipient allowlist, session log | EM-01.1 to EM-01.4, EM-01.6, EM-02, EM-09 | W2 |
| W5 | Event bus and realtime: `email.received` and friends, WebSocket `/api/v1/ws`, SSE `/api/v1/events`, `/events/recent` | PL-02 | W3, W4 |
| W6 | Logs, settings and system: the HTTP request log, Logs endpoints, Settings (General, Email, Notifications, OTP patterns), `reset`, `samples/email`, `integrations/{stack}`, the real update check | PL-05 (the parts these sections cover), PL-03.5 (email), SM-13 (API log) | W5 |
| W7 | CLI and MCP: the `sendmail` shim, the MCP server over stdio with the `core`, `email` and `extract` toolsets, `--ready-json` | EM-06, AI-02.1 to AI-02.4, PL-03.4, DS-06.1 | W1, W3 |
| W8 | Live UI: `available_operations`, the phase per catalogue entry and Not available yet; the live build in the binary; UI and API auth; CORS and the playground's Local mode | UI-12, PL-06.2, PL-06.4, WS-05 | W3 to W6 |
| W9 | Compatibility and packaging: SMTP clients in eight languages in CI, `.deb` and `.rpm`, the Homebrew `sendmock-beta` formula and Docker `beta` tags in `release.yml` | EM-01.5, DS-03.3 (Phase 1 part) | W4, W8 |

## W1: Operation framework

The Phase 0 registry handled two GET operations and one JSON POST. Phase 1 needs the rest of the contract's shapes, once, for every later operation:

- **Path parameters:** `{emailId}` in a path becomes an input field of the same name, filled from the URL by the REST adapter, a positional argument on the CLI (in path order) and an MCP input.
- **Typed query parameters:** query strings are converted to the input schema's types (booleans, integers, numbers, string lists) before the input is decoded, so operations take typed inputs.
- **Answers:** a definition names its success status (`200`, `201`, `204`); `204` answers carry no body. A file answer (`.eml`, an attachment, a thumbnail) has its content type and file name; the CLI writes it to stdout or `--output`, and MCP returns it as a resource.
- **Raw request bodies:** an operation can take its body as raw text (`POST /send/raw` takes `message/rfc822`).
- **CLI flags and MCP inputs from the input schema**, by the rules in [21](21-reference-and-examples.md#2-one-rule-set-for-cli-flags-and-mcp-inputs): query parameters and top-level body fields become `--kebab-case` flags, booleans `--name` and `--no-name` without the `is_` prefix, lists repeat the flag, objects take JSON; `--data` and `--file` give the whole body. Destructive commands refuse without `--yes` (AI-01.4).
- **Pages:** one cursor format (`next_cursor` is the last id seen, base64) and one `PageOf<T>` type for every list.
- The contract test learns file answers and `204`, and keeps requiring sample inputs per operation.
- **As built:** `OperationDefinition::DEFAULTS` keeps definitions short; new fields `is_destructive`, `success_status`, `answer_kind` and `raw_body_input`. Outputs of type `FileAnswer` or `NoContent` are recognised by type in the registry (`OperationAnswer`), so operations stay typed. `build_input_from_text` (ops) converts query, path and flag text by the input's JSON Schema, shared by REST and the CLI. The REST adapter reads path values even on routes without any (`RawPathParams`) and keeps repeated query keys; the OpenAPI document gains path and query parameters, bodies without path fields, `201`, `204`, binary answers and raw request bodies. The CLI builds positional arguments and flags from the input schema by the web generator's own rules (`flag_naming.rs` mirrors `input-naming.ts`), adds `--data`, `--file`, `--yes` and `--output`, and the client fills paths, queries and bodies and saves files. AI-01.4 ticked.

## W2: Email storage and parsing

- Migration `0002_email.sql`: `emails` (the columns in [02](02-architecture.md#emails)), `emails_fts` (FTS5 over subject, addresses and text, kept in step by triggers), `email_attachments` (index, file name, content type, size, Content-ID, inline flag), `email_timeline`, `smtp_sessions`, `api_requests`.
- `EmailRepository` holds every query; `EmailIngestService` turns raw bytes plus an envelope into a stored email: `mail-parser` for headers, bodies and attachments, `zstd` for the raw bytes, BCC from envelope recipients missing in To and Cc, the snippet, OTP and link extraction (default and custom patterns from Settings), tags from `X-Tags` and plus addressing, then `email.received`.
- Retention: a background task prunes traffic over `--max-emails` or `--max-age` in small batches, never configuration (PL-08).
- **As built:** a new domain crate, `sendmock-mail` (layer 2, beside `sendmock-sms` and `sendmock-webhooks`), since the crate list had no home for the email domain: `parsing/` (`parse_email` on `mail-parser` 1.0, the MIME tree), `extraction/` (`OtpExtractor` with default or custom patterns on `regex`, links, `X-Tags` and plus-address tags), the zstd codec and `EmailIngestService`. In `sendmock-store`, `0002_email.sql` adds `emails`, `email_attachments`, `email_timeline` and the `emails_fts` FTS5 table kept in step by triggers; `EmailRepository` holds the queries, with `EmailListFilter` building the SQL conditions (search words become quoted prefix terms, so punctuation never breaks FTS5). Cursors are the last email id (ULIDs sort by time). Searching 10,000 emails is tested under the 200 ms budget. The runtime retention task and the `--max-emails` setting come with Settings in W6.

## W3: Email operations

Each operation is one command object in `sendmock-ops/src/email/`, answering exactly the contract's types (`EmailSummary`, `EmailDetail`, `MimePart`, `EmailTimelineEntry`, `ListUnsubscribeReport`, `ExtractedCode`, ...), so the contract test checks them. Search parses `from:`, `to:`, `subject:`, `has:attachment`, `is:unread`, `tag:` and `source:` and sends the rest to FTS5. Native send builds a MIME message and stores it through the same ingest path as SMTP, so both give the same email (EM-07.1).

**As built:** 17 email operations (list, latest, show, update, delete, delete all, timeline, MIME, List-Unsubscribe check, raw, attachment, thumbnail, send, send raw, `otp`, `links`, `wait/email`). Contract fields that are nullable but required carry `#[schemars(required)]`. Timestamps are formatted by new RFC 3339 and RFC 5322 helpers in `sendmock-core` (no date crate). Native send validates field by field (`attachments[0].content`, ...) and builds the message with a small MIME builder in `sendmock-mail` (`native_message.rs`); the parser now treats inline images and attached messages as attachments, which RFC 8621 counts as body. Raw, attachment and thumbnail are MCP resources, so the tool list skips them. The CLI learned usages with placeholders between command words (`sendmock email check <emailId> unsubscribe`), flags in usages (`sendmock otp --to <recipient>`) and renamed flags (`--wait`); the parity job now compares each command's words, arguments and flags with `cli-reference.json`, and all 20 operations match. The contract test creates its emails through `POST /send` and runs destructive operations last.

## W4: SMTP server

`sendmock-smtp` holds a receive-only state machine (`SmtpSession`) separate from the I/O (`SmtpListener`), so commands, replies and limits are unit tested without sockets. STARTTLS and the SMTPS listener use `rustls` with a certificate generated by `rcgen` on first run and stored in the data folder, or `--smtp-tls-cert` and `--smtp-tls-key`. Every session is logged with its transcript, AUTH passwords masked and DATA linked (EM-09).

## W5: Event bus and realtime

An `EventBus` (a `tokio::sync::broadcast` channel behind a trait) carries every event as the native webhook envelope (`{ id, type, created_at, data }`). The WebSocket and SSE handlers subscribe; `/events/recent` reads a ring buffer of the last events. Webhooks subscribe in Phase 3.

## W6: Logs, settings and system

A tower layer records every API request (method, path, status, duration, bodies capped) into `api_requests`. Settings are typed sections stored in the `settings` table; each phase adds its section. `reset` deletes traffic; `samples/email` sends a message over SMTP to SendMock itself, so it shows in Logs > SMTP. The update check calls the GitHub Releases API once a day at most, caches the answer for 24 hours, and builds the upgrade command for the running platform (PL-05.10 to PL-05.13).

## W7: CLI and MCP

`sendmock sendmail [-t] [-f from] [recipients]` reads stdin and submits it to the SMTP listener; a binary started as `sendmail` behaves the same. `sendmock mcp` serves the tools from W6 of Phase 0 over stdio with `rmcp`, with `--toolsets` and `--read-only`, and never returns a secret. `--ready-json` prints the bound addresses as one JSON line once listening (port `0` allowed).

## W8: Live UI

`GET /info` gains `available_operations`; each surface catalogue entry gains its phase; the UI's shared `useOperationAvailability` hook and `NotAvailableYetState` cover every screen and button ([07](07-ui.md#not-available-yet-stage-b)). The binary embeds the live build. `--ui-auth user:pass` (or an htpasswd file) protects the UI, the API, the WebSocket and MCP over HTTP, with the API token as an alternative; CORS allows the docs playground's origin unless `--cors-origins` changes it.

## W9: Compatibility and packaging

`examples/` gets a small sender per language (PHP with Laravel, Node with Nodemailer, Python smtplib and Django, Go, Java with Spring, Rust with lettre, Ruby with Rails, .NET with MailKit), run in a Docker matrix against the binary on pull requests that touch SMTP. `release.yml` adds `.deb` and `.rpm` (built with `nfpm` from the Linux archives), the Homebrew `sendmock-beta` formula update and the Docker `beta` and `X.Y.Z-beta.N` tags.

## New dependencies

| Crate | Used by | Why |
|-------|---------|-----|
| `mail-parser` | W2 | MIME parsing that copes with broken real-world mail; already in the plan |
| `zstd` | W2 | raw messages compressed at rest; already in the plan |
| `rustls`, `tokio-rustls`, `rcgen` | W4 | STARTTLS and SMTPS without OpenSSL; already in the plan |
| `rmcp` | W7 | the official Rust MCP SDK; already in the plan |
| `base64` | W1, W3 | cursors and attachment content |
