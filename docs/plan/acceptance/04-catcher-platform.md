# Acceptance: HTTP catcher (HC) and Platform (PL)

Plan: [15-http-catcher.md](../15-http-catcher.md), [02-architecture.md](../02-architecture.md), [06-api.md](../06-api.md). Rules for IDs, ticking and tests: [README.md](README.md).

## HC-01 Capture requests

UI in U2, backend Phase 4.

- [ ] HC-01.1 Any method and path under `/catch/<bin>/...` is captured with method, URL, query, headers, body and timing; the bin is created on first use.
- [ ] HC-01.2 JSON, form and multipart bodies are parsed and shown pretty; uploaded files are downloadable.
- [ ] HC-01.3 `http.captured` fires and the request appears in the UI live.
- [ ] HC-01.4 The optional catch-all port captures requests at any path.
- [ ] HC-01.5 "Forward to URL" resends a captured request; "Copy as cURL" reproduces it.
- [ ] HC-01.6 The HTTP screen lists bins with preset, request count and last request, and a bin's requests newest first (method, path, status returned, time); a bin can be added from a preset, its catch URL copied, its requests cleared and the bin deleted.
- [ ] HC-01.7 The request detail shows the full URL, headers, query, the body pretty or raw, uploaded files to download, and the response sent with the rule that produced it; "Send to webhook" sends the captured request to an endpoint.

## HC-02 Mock responses

UI in U2, backend Phase 4.

- [ ] HC-02.1 Response rules match in order on method, path and filters; the default reply is `200 {"ok":true}`.
- [ ] HC-02.2 Status, headers and templated bodies (including echoed request data) are returned as configured.
- [ ] HC-02.3 Delay and failure rate behave as configured.
- [ ] HC-02.4 The Responses tab orders, toggles, edits and deletes a bin's rules and edits its default reply; the rule editor sets method, path glob, header and body conditions, status, headers, templated body, delay and failure rate, and previews against a captured request whether the rule matches and what it returns.

## HC-03 Presets

Phase 4 (Slack, Discord, Telegram, FCM), Phase 5 (Teams, Google Chat, Expo, OneSignal).

- [ ] HC-03.1 Each preset returns a reply the official client library accepts without error.
- [ ] HC-03.2 Slack Block Kit, Discord embeds and push notifications are rendered as previews.

---

## PL-01 REST API and OpenAPI

Phase 0 onwards.

- [ ] PL-01.1 Every endpoint in [06-api.md](../06-api.md) exists and matches `docs/api/openapi.yaml` (contract tests).
- [ ] PL-01.2 Errors use `{ "error": { "code", "message" } }` with the right HTTP status; times are RFC 3339 UTC; pagination uses `next_cursor`.
- [ ] PL-01.3 `/api/openapi.json` is served and valid.

## PL-02 Realtime

Phase 1.

- [ ] PL-02.1 Every event is pushed over WebSocket (`/api/v1/ws`) and SSE (`/api/v1/events`) within 500 ms.
- [ ] PL-02.2 A client that reconnects resumes without duplicate or missing list entries.

## PL-03 Test helpers

Phase 1 (email), Phase 2 (SMS, Verify), Phase 4 (HTTP), Phase 3 (webhook wait).

- [ ] PL-03.1 `wait/email`, `wait/sms`, `wait/http` and `wait/webhook` return as soon as a match arrives and `408` after the timeout.
- [ ] PL-03.2 `since` prevents matching messages older than the request window.
- [ ] PL-03.3 `otp` and `links` return the latest values per recipient and channel.
- [ ] PL-03.4 `--ready-json` with port `0` prints the bound addresses once ready.
- [ ] PL-03.5 `POST /samples/{kind}` creates an email (over SMTP, with its SMTP session logged), an SMS or a verification through the normal path, firing the same events and webhooks as real traffic, with matching CLI and MCP commands.

## PL-04 Seed file and reset

UI in U1, backend Phase 0 (parse, validate) and Phase 3 (full coverage).

- [ ] PL-04.1 A seed file creates every supported item type; starting twice with the same seed changes nothing (idempotent).
- [ ] PL-04.2 `${ENV_VAR}` references resolve; literal secrets are never written by export.
- [ ] PL-04.3 `reset` wipes all traffic and restores exactly the seed state.
- [ ] PL-04.4 `seed export` then `seed apply` on a fresh instance reproduces the same configuration.
- [ ] PL-04.5 `seed validate` reports errors with file line numbers and changes nothing.
- [ ] PL-04.6 Settings > Seed shows the seed status, exports the file, and validates then applies an uploaded or pasted file after a confirmation.

## PL-05 Settings

UI in U1, backend per feature phase.

- [ ] PL-05.1 Every setting in the Settings screen is saved, applied without restart and returned by `GET /settings`.
- [ ] PL-05.2 Invalid values are rejected with a field-level error.
- [ ] PL-05.3 Each section saves only its own changes, Save is disabled until something changed, and Discard restores the saved values.
- [ ] PL-05.4 Reset to seed and the delete-all buttons ask for confirmation before acting.
- [ ] PL-05.5 Connection snippets exist for every listed language and use the host for where the app runs (local, Docker host, Compose service) and the ports from `/info`.
- [ ] PL-05.7 Request headers and optional payload fields added in Connection appear in every language's API snippet, in that language's syntax; invalid JSON is flagged.
- [ ] PL-05.8 A `{{file:<name>}}` value in a Connection body makes every language's snippet read and base64-encode that file and put it in the body.
- [ ] PL-05.9 The SMS body in Connection offers `media` and `media_urls` chips.
- [ ] PL-05.6 About shows the version, channel, listeners and database, and the update check never runs until it is turned on.
- [ ] PL-05.10 The update check has the modes Off (default), Manual and Daily in Settings > About, `sendmock.toml` and `SENDMOCK_UPDATE_CHECK`; Daily checks on start and once a day, and Manual only on request.
- [ ] PL-05.11 A found version shows its date, its release notes and the upgrade command for the install method (Homebrew, Scoop, Docker, install script, npm, or the release page when unknown); with Daily it raises one header notification per new version.
- [ ] PL-05.12 Stable installs are offered stables only, beta installs the newer of the newest beta and stable, edge and dev builds nothing; the check sends no identifiers, is cached for 24 hours, and reports "Could not check for updates" when GitHub cannot be reached.
- [ ] PL-05.13 The upgrade command matches the platform SendMock runs on and is one the Install page gives for that platform and channel: the install script is `install.sh` on macOS and Linux and `install.ps1` in PowerShell on Windows, Homebrew is offered only on macOS and Linux, Scoop only on Windows, Docker and npm everywhere; a method that does not exist on the platform shows only the release page link.

## PL-06 Security defaults

Phase 0 onwards.

- [ ] PL-06.1 The native binary binds only `127.0.0.1` by default; Docker binds `0.0.0.0` and prints a notice when no UI auth is set.
- [ ] PL-06.2 With `--ui-auth`, UI, API, WebSocket and MCP over HTTP all require credentials or the API token.
- [ ] PL-06.3 No secret (webhook secrets, provider tokens, SMTP AUTH passwords, relay passwords) appears in any API response, log line, MCP result or export.
- [ ] PL-06.4 CORS only allows the configured origins; the docs playground origin can be removed with `--cors-origins`.

## PL-07 Configuration

Phase 0.

- [x] PL-07.1 Flags override `SENDMOCK_*` env vars, which override `sendmock.toml`, which overrides defaults. (#48)
- [x] PL-07.2 Unknown keys and invalid values fail at startup with a clear message. (#48)
- [x] PL-07.3 A port already in use fails with a message suggesting the flag to change it. (#48)

## PL-08 Retention

Phase 1.

- [ ] PL-08.1 Count and age limits prune traffic (emails, SMS, verifications, HTTP requests, logs, deliveries) and never configuration.
- [ ] PL-08.2 Pruning does not block ingest; the DB size stays stable under continuous load.
