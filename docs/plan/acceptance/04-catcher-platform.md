# Acceptance: HTTP catcher (HC) and Platform (PL)

Plan: [15-http-catcher.md](../15-http-catcher.md), [02-architecture.md](../02-architecture.md), [06-api.md](../06-api.md). Rules for IDs, ticking and tests: [README.md](README.md).

## HC-01 Capture requests

UI in U2, backend Phase 4.

- [x] HC-01.1 Any method and path under `/catch/<bin>/...` is captured with method, URL, query, headers, body and timing; the bin is created on first use. (#48)
- [x] HC-01.2 JSON, form and multipart bodies are parsed and shown pretty; uploaded files are downloadable. (#48)
- [x] HC-01.3 `http.captured` fires and the request appears in the UI live. (#48)
- [x] HC-01.4 The optional catch-all port captures requests at any path. (#48)
- [x] HC-01.5 "Forward to URL" resends a captured request; "Copy as cURL" reproduces it. (#48)
- [x] HC-01.6 The HTTP screen lists bins with preset, request count and last request, and a bin's requests newest first (method, path, status returned, time); a bin can be added from a preset, its catch URL copied, its requests cleared and the bin deleted. (#48)
- [x] HC-01.7 The request detail shows the full URL, headers, query, the body pretty or raw, uploaded files to download, and the response sent with the rule that produced it; "Send to webhook" sends the captured request to an endpoint. (#48)

## HC-02 Mock responses

UI in U2, backend Phase 4.

- [x] HC-02.1 Response rules match in order on method, path and filters; the default reply is `200 {"ok":true}`. (#48)
- [x] HC-02.2 Status, headers and templated bodies (including echoed request data) are returned as configured. (#48)
- [x] HC-02.3 Delay and failure rate behave as configured. (#48)
- [x] HC-02.4 The Responses tab orders, toggles, edits and deletes a bin's rules and edits its default reply; the rule editor sets method, path glob, header and body conditions, status, headers, templated body, delay and failure rate, and previews against a captured request whether the rule matches and what it returns. (#48)

## HC-03 Presets

Phase 4 (Slack, Discord, Telegram, FCM), Phase 5 (Teams, Google Chat, Expo, OneSignal).

- [x] HC-03.1 Each preset returns a reply the official client library accepts without error. (#48)
- [x] HC-03.2 Slack Block Kit, Discord embeds and push notifications are rendered as previews. (#48)

---

## PL-01 REST API and OpenAPI

Phase 0 onwards.

- [x] PL-01.1 Every endpoint in [06-api.md](../06-api.md) exists and matches `docs/api/openapi.yaml` (contract tests).
- [x] PL-01.2 Errors use `{ "error": { "code", "message" } }` with the right HTTP status; times are RFC 3339 UTC; pagination uses `next_cursor`. (#48)
- [x] PL-01.3 `/api/openapi.json` is served and valid. (#48)
- [x] PL-01.4 The UI's API reference lists every operation of the instance's `/api/openapi.json` by tag, with search, each operation's parameters, request body and answer, and a `curl` command for that instance.
- [x] PL-01.5 Each release attaches `openapi.yaml`, and the website serves `/openapi.yaml` with a download link on its API reference.

## PL-02 Realtime

Phase 1; PL-02.3 to PL-02.5 in Phase 5 (W19).

- [x] PL-02.1 Every event is pushed over WebSocket (`/api/v1/ws`) and SSE (`/api/v1/events`) within 500 ms. (#48)
- [x] PL-02.2 A client that reconnects resumes without duplicate or missing list entries. (#48)
- [x] PL-02.3 (added 2026-11-12, owner report: the UI stopped showing new mail while thousands of emails arrived) While 5,000 emails arrive over SMTP as fast as one client sends them, the open mail list shows each new message within 2 seconds of its arrival, the browser asks for each list at most 4 times a second and never cancels a request it started, and the counters show the final totals within 2 seconds of the last message. (#225)
- [x] PL-02.4 (added 2026-11-12, owner report) During that burst a message opened from the list shows within 2 seconds, and toasts appear at most once every 2 seconds, each saying how many more arrived. (#225)
- [x] PL-02.5 (added 2026-11-12, owner report) A realtime client that falls behind is disconnected instead of skipping events; after it reconnects the UI refetches each open list once and shows every stored message. (#225)

## PL-03 Test helpers

Phase 1 (email), Phase 2 (SMS, Verify), Phase 4 (HTTP), Phase 3 (webhook wait).

- [x] PL-03.1 `wait/email`, `wait/sms`, `wait/http` and `wait/webhook` return as soon as a match arrives and `408` after the timeout. (#48)
- [x] PL-03.2 `since` prevents matching messages older than the request window. (#48)
- [x] PL-03.3 `otp` and `links` return the latest values per recipient and channel. (#48)
- [x] PL-03.4 `--ready-json` with port `0` prints the bound addresses once ready. (#48)
- [x] PL-03.5 `POST /samples/{kind}` creates an email (over SMTP, with its SMTP session logged), an SMS or a verification through the normal path, firing the same events and webhooks as real traffic, with matching CLI and MCP commands. (#48)

## PL-04 Seed file and reset

UI in U1, backend Phase 0 (parse, validate) and Phase 3 (full coverage).

- [x] PL-04.1 A seed file creates every supported item type; starting twice with the same seed changes nothing (idempotent). (#48)
- [x] PL-04.2 `${ENV_VAR}` references resolve; literal secrets are never written by export. (#48)
- [x] PL-04.3 `reset` wipes all traffic and restores exactly the seed state. (#48)
- [x] PL-04.4 `seed export` then `seed apply` on a fresh instance reproduces the same configuration. (#48)
- [x] PL-04.5 `seed validate` reports errors with file line numbers and changes nothing. (#48)
- [x] PL-04.6 Settings > Seed shows the seed status, exports the file, and validates then applies an uploaded or pasted file after a confirmation. (#48)

## PL-05 Settings

UI in U1, backend per feature phase.

- [x] PL-05.1 Every setting in the Settings screen is saved, applied without restart and returned by `GET /settings`. (#48)
- [x] PL-05.2 Invalid values are rejected with a field-level error. (#48)
- [x] PL-05.3 Each section saves only its own changes, Save is disabled until something changed, and Discard restores the saved values. (#48)
- [x] PL-05.4 Reset to seed and the delete-all buttons ask for confirmation before acting. (#48)
- [x] PL-05.5 Connection snippets exist for every listed language and use the host for where the app runs (local, Docker host, Compose service) and the ports from `/info`. (#48)
- [x] PL-05.7 Request headers and optional payload fields added in Connection appear in every language's API snippet, in that language's syntax; invalid JSON is flagged. (#48)
- [x] PL-05.8 A `{{file:<name>}}` value in a Connection body makes every language's snippet read and base64-encode that file and put it in the body. (#48)
- [x] PL-05.9 The SMS body in Connection offers `media` and `media_urls` chips. (#48)
- [x] PL-05.6 About shows the version, channel, listeners and database, and the update check never runs until it is turned on. (#48)
- [x] PL-05.10 The update check has the modes Off (default), Manual and Daily in Settings > About, `sendmock.toml` and `SENDMOCK_UPDATE_CHECK`; Daily checks on start and once a day, and Manual only on request. (#48)
- [x] PL-05.11 A found version shows its date, its release notes and the upgrade command for the install method (Homebrew, Scoop, Docker, install script, npm, or the release page when unknown); with Daily it raises one header notification per new version. (#48)
- [x] PL-05.12 Stable installs are offered stables only, beta installs the newer of the newest beta and stable, edge and dev builds nothing; the check sends no identifiers, is cached for 24 hours, and reports "Could not check for updates" when GitHub cannot be reached. (#48)
- [x] PL-05.13 The upgrade command matches the platform SendMock runs on and is one the Install page gives for that platform and channel: the install script is `install.sh` on macOS and Linux and `install.ps1` in PowerShell on Windows, Homebrew is offered only on macOS and Linux, Scoop only on Windows, Docker and npm everywhere; a method that does not exist on the platform shows only the release page link. (#48)

## PL-06 Security defaults

Phase 0 onwards.

- [x] PL-06.1 The native binary binds only `127.0.0.1` by default; Docker binds `0.0.0.0` and prints a notice when no UI auth is set. (#48)
- [x] PL-06.2 With `--ui-auth`, UI, API, WebSocket and MCP over HTTP all require credentials or the API token. (#48)
- [x] PL-06.3 No secret (webhook secrets, provider tokens, SMTP AUTH passwords, relay passwords) appears in any API response, log line, MCP result or export. (#48)
- [x] PL-06.4 CORS only allows the configured origins; the docs playground origin can be removed with `--cors-origins`. (#48)

## PL-07 Configuration

Phase 0.

- [x] PL-07.1 Flags override `SENDMOCK_*` env vars, which override `sendmock.toml`, which overrides defaults. (#48)
- [x] PL-07.2 Unknown keys and invalid values fail at startup with a clear message. (#48)
- [x] PL-07.3 A port already in use fails with a message suggesting the flag to change it. (#48)

## PL-08 Retention

Phase 1.

- [x] PL-08.1 Count and age limits prune traffic (emails, SMS, verifications, HTTP requests, logs, deliveries) and never configuration. (#48)
- [x] PL-08.2 Pruning does not block ingest; the DB size stays stable under continuous load. (#48)
- [x] PL-08.3 `--max-sms` (`SENDMOCK_MAX_SMS`, `max_sms` in `sendmock.toml`) sets the SMS limit as `--max-emails` sets the email limit, with flags over the environment over the file, and a value given at startup overwrites the stored setting. (#187)
  - Added 2026-11-08 (owner request): the plan listed `--max-sms` from the start, but only Settings and the API could set the SMS limit.
- [x] PL-08.4 A count limit of 0 keeps that traffic with no count limit (the age limit still applies), through the flags, the file, Settings, the API, the CLI and MCP; while a limit is 0 and no age limit is set, SendMock logs a warning at startup and Settings shows a warning beside the field. (#187)
  - Added 2026-11-08 (owner request): unlimited storage when asked, with a caution; before, the limits took 1 to 1,000,000.

## PL-09 Demo data

Phase 5. Plan: [30-phase-5.md](../30-phase-5.md) (W8).

- [x] PL-09.1 `sendmock serve --demo` (or `SENDMOCK_DEMO=1`) on an empty instance loads the website demo's sample data: emails, SMS conversations, verifications, webhook endpoints, rules and deliveries, HTTP bins with requests, and payments, each made through the same operation real traffic uses. (#48)
- [x] PL-09.2 Loading sends nothing off the machine, and the sample data is stored and shown as any other data: events fire and rules queue deliveries, search finds it, and reset clears its traffic and treats its endpoints, rules and bins as any other configuration (kept without a seed file). (#48)
  - Changed 2026-11-06 while building W8: the first wording said reset clears the demo data unless a seed file holds it, but reset without a seed file keeps all configuration (PL-04), so the demo's endpoints, rules and bins follow that rule like configuration made by hand.
- [x] PL-09.3 With data already stored, `--demo` loads nothing and says so in the log; the data file the binary embeds matches the mock's fixtures, checked by a test. (#48)

## PL-10 Projects

After 1.0, built on `feat/phase-0` by owner decision (2026-11-07). Plan: [32-after-1-0.md](../32-after-1-0.md#a5-projects-multi-project-inboxes-pl-10).

- [x] PL-10.1 Projects are listed, created, renamed and deleted through REST, CLI and MCP; keys are lowercase letters, digits and dashes; `default` always exists and cannot be deleted; deleting a project deletes its emails, SMS and verifications. (#48)
- [x] PL-10.2 An email sent over SMTP with an AUTH username that is a project's key is stored in that project; without AUTH, or with any other username, it is stored in `default`. (#48)
- [x] PL-10.3 The REST send APIs and the provider APIs store their email, SMS or verification in the project named by `X-SendMock-Project`; an unknown project is refused with 404. (#48)
- [x] PL-10.4 A provider API called under `/projects/<project>/` stores its message in that project and answers as it does without the prefix; an official SDK given that base URL sends through it. (#48)
- [x] PL-10.5 Every list and lookup of captured traffic (emails, SMS, threads, verifications, OTP, links, wait helpers, recent events) takes `project` and returns only that project's items; without it, every project's. (#48)
- [x] PL-10.6 Events carry `project` in their data, and a webhook rule can filter on it. (#48)
- [x] PL-10.7 The UI shows a project switcher, kept in the URL, once a second project exists; it filters Mail, SMS and Verify; Settings > Projects manages projects and shows how to send to each. (#48)
- [x] PL-10.8 The seed file exports and imports projects, and reset keeps them. (#48)

## PL-11 Prometheus metrics

After 1.0, planned 2026-11-08 by owner request. Plan: [32-after-1-0.md](../32-after-1-0.md#a12-monitoring-prometheus-metrics-opentelemetry-and-log-files-pl-11-pl-12-pl-13) (A12a).

- [ ] PL-11.1 Without `--metrics`, `GET /metrics` answers 404; `--metrics`, `SENDMOCK_METRICS=true` or `metrics = true` in `sendmock.toml` turn it on, with flags over the environment over the file.
- [ ] PL-11.2 When on, `GET /metrics` answers the Prometheus text format (`text/plain; version=0.0.4`) with `# HELP` and `# TYPE` for every family, and `promtool check metrics` finds no problem in it.
- [ ] PL-11.3 The gauges report what is stored now: emails, unread emails, SMS, unread SMS, pending verifications, HTTP requests, push notifications, payments, webhook deliveries waiting for a retry and the database size in bytes; they fall after a delete, a reset or retention pruning, and a scrape never waits on the writer queue.
- [ ] PL-11.4 `sendmock_events_total{type}` counts every event published since start, one series per event type, equal to the events the event stream sent; `sendmock_smtp_rejected_total` counts refused SMTP messages; the counters only rise while the process runs.
- [ ] PL-11.5 `sendmock_build_info{version}` is 1, `process_start_time_seconds` is the start time, and on Linux `process_resident_memory_bytes` is the resident memory.
- [ ] PL-11.6 With `--ui-auth` or `--api-token`, `/metrics` needs the same credentials as the API (basic auth or the bearer token); its labels hold only event type names and the version, never an address, a number, message content or a secret.
- [ ] PL-11.7 `GET /api/v1/metrics`, `sendmock metrics --json` and the MCP `sendmock_stats` tool with `view: metrics` answer the same families and values as `/metrics`, whether or not `--metrics` is on.
- [ ] PL-11.8 While metrics is on, Settings > Connection shows the scrape URL and a copyable `prometheus.yml` job with the auth lines the instance needs, and `/api/v1/info` carries `metrics_path` (null when off).
- [ ] PL-11.9 The Helm chart's `metrics.enabled` turns metrics on and adds the scrape annotations, and `metrics.serviceMonitor.enabled` renders a ServiceMonitor; CI renders both and scrapes `/metrics` on the kind cluster.
- [ ] PL-11.10 `examples/monitoring/` runs SendMock with Prometheus in Docker Compose; CI sends an email and finds `sendmock_events_total{type="email.received"}` at 1 through Prometheus's query API.

## PL-12 OpenTelemetry export

After 1.0, planned 2026-11-08 by owner request. Plan: [32-after-1-0.md](../32-after-1-0.md#a12-monitoring-prometheus-metrics-opentelemetry-and-log-files-pl-11-pl-12-pl-13) (A12b).

- [ ] PL-12.1 Without an OTLP endpoint variable, or with `OTEL_SDK_DISABLED=true`, nothing is exported and no exporter runs; `OTEL_EXPORTER_OTLP_ENDPOINT` (or a per-signal endpoint) turns export on over OTLP `http/protobuf`.
- [ ] PL-12.2 `OTEL_SERVICE_NAME` (default `sendmock`), `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_EXPORTER_OTLP_HEADERS` and `OTEL_METRIC_EXPORT_INTERVAL` work as the OpenTelemetry specification defines them, and header values are masked wherever SendMock shows its settings or logs.
- [ ] PL-12.3 Every log line reaches the collector as a log record with its level, target and fields, and still goes to stdout.
- [ ] PL-12.4 The collector receives the same metric families and values as `/metrics`.
- [ ] PL-12.5 SMTP sessions, REST and provider API requests, webhook delivery attempts, status callbacks and releases each make a span with the operation id and outcome; an incoming `traceparent` header continues the caller's trace; no span holds message content, an address, a number or a secret.
- [ ] PL-12.6 The binary with OpenTelemetry stays inside the size and idle memory budgets of the distribution plan, or OpenTelemetry ships only in the Docker image and an `-otel` binary, as the plan records with the measured numbers.
- [ ] PL-12.7 CI runs the OpenTelemetry Collector with its file exporter next to SendMock, sends an email, an SMS and a webhook, and finds the log records, metric points and spans (with the caller's `traceparent` kept) in its output.

## PL-13 Log files and readiness

After 1.0, planned 2026-11-08 by owner request. Plan: [32-after-1-0.md](../32-after-1-0.md#a12-monitoring-prometheus-metrics-opentelemetry-and-log-files-pl-11-pl-12-pl-13) (A12c).

- [ ] PL-13.1 `--log-file <path>` (`SENDMOCK_LOG_FILE`, `log_file` in `sendmock.toml`) also writes the logs to that file in the chosen format, rotated daily or past `--log-file-max-size` (default 10 MB), keeping `--log-file-keep` files (default 7); stdout is unchanged.
- [ ] PL-13.2 JSON log lines keep their fields and add `trace_id` and `span_id` while a span is active, and the docs list every field.
- [ ] PL-13.3 `GET /api/v1/health/ready` and `sendmock health --ready` answer ready only once the listeners are bound and the database answers a read, and not ready while starting and once shutdown has begun; `GET /api/v1/health` stays the liveness check.
- [ ] PL-13.4 The Helm chart's readiness probe uses the readiness path, and the tray app starts its server with a log file in its data folder.
- [ ] PL-13.5 The Monitoring guide page covers health and readiness, logs and how to collect them (Docker logging drivers, the systemd journal, Fluent Bit, Vector, Grafana Alloy), every metric, the Prometheus and OpenTelemetry setups for Docker Compose and Helm and the starter Grafana dashboard, and the configuration reference and the skill list every option.

## PL-14 Accounts and login

After 1.0, planned 2026-11-08 by owner request, for later. Plan: [32-after-1-0.md](../32-after-1-0.md#a13-accounts-login-and-roles-admin-developer-viewer-pl-14-pl-15) (A13a).

- [ ] PL-14.1 Without `--auth accounts` SendMock needs no sign-in, as before; `--auth accounts` (`SENDMOCK_AUTH`, `auth = "accounts"` in `sendmock.toml`) turns accounts on, `--ui-auth` keeps working unchanged, and setting both fails at startup with a clear message.
- [ ] PL-14.2 On an instance with no users, `SENDMOCK_ADMIN_USERNAME` and `SENDMOCK_ADMIN_PASSWORD` (or their `_FILE` variants) create the first Admin; without them the setup page creates it only with the one-time code printed in the log at start, and `sendmock users reset-password` recovers a lost password from the data file.
- [ ] PL-14.3 Passwords are stored only as Argon2id hashes with at least OWASP's parameters, must be 12 characters or more, and appear in no API answer, log line, MCP result or seed export.
- [ ] PL-14.4 Signing in sets a new random session id in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` over HTTPS); the session ends after the idle timeout, the absolute timeout, sign-out, or a password or role change.
- [ ] PL-14.5 Failed sign-ins are slowed per username and address after five a minute, and the answer is the same whether or not the username exists.
- [ ] PL-14.6 A browser request that changes something is refused without the UI's header and a same-origin `Origin`.
- [ ] PL-14.7 Personal access tokens act as their user and service tokens carry their own role; each is shown once, stored hashed, can expire, records when it was last used and can be revoked on its own; `--api-token` works as an Admin service token.
- [ ] PL-14.8 The REST API, the WebSocket stream and MCP over HTTP accept the session cookie or a bearer token and refuse anything else with 401; the CLI signs in with `SENDMOCK_TOKEN` or `sendmock login`; provider APIs and SMTP keep their own credentials.
- [ ] PL-14.9 Sign-ins, failed sign-ins, user, role and token changes and every destructive operation are recorded with who, when and from where, shown to Admins in the Logs screen's Audit tab, and pruned by retention.
- [ ] PL-14.10 Admins manage users and tokens in Settings > Users and tokens, everyone manages their own account in Settings > Account, and both work the same through REST, `sendmock users`, `sendmock tokens` and MCP.

## PL-15 Roles: Admin, Developer, Viewer

After 1.0, planned 2026-11-08 by owner request, for later. Plan: [32-after-1-0.md](../32-after-1-0.md#a13-accounts-login-and-roles-admin-developer-viewer-pl-14-pl-15) (A13b).

- [ ] PL-15.1 Every operation in the registry declares the role it needs (read-only operations Viewer, others Developer, instance administration Admin), and a snapshot test lists every operation with its role.
- [ ] PL-15.2 A Viewer can call every read-only operation and nothing else; opening an email or SMS does not mark it read for a Viewer.
- [ ] PL-15.3 A Developer can send, simulate, delete and reset traffic, release within the allowlist and manage webhooks, rules, templates, variables, bins, scenarios, providers, numbers and projects, but not users, tokens other than their own, the audit log or instance settings.
- [ ] PL-15.4 An Admin can call every operation, and the last Admin cannot be removed or demoted.
- [ ] PL-15.5 The role check runs once in the operations layer, so REST answers 403, the CLI exits with its permission code and MCP returns an error naming the role needed, for the same operations.
- [ ] PL-15.6 The UI shows controls the role cannot use as disabled with the role they need, and shows the signed-in user and role in the top bar.
- [ ] PL-15.7 MCP lists only the tools the token's role may call, and a role change applies on the user's next request.

## PL-16 Real provider connections

After 1.0, planned 2026-11-08 by owner request, for later. Plan: [32-after-1-0.md](../32-after-1-0.md#a14-real-forwarding-provider-connections-and-routing-rules-for-email-and-sms-pl-16-pl-17) (A14a).

- [ ] PL-16.1 Named connections to SMTP, SendGrid, Mailgun, Amazon SES, Postmark and Resend for email and Twilio, Vonage, Plivo, Telnyx, Infobip and Amazon SNS for SMS are created, edited, tested and deleted through the UI, REST, CLI, MCP and the seed file; the existing relay settings become the `relay` connection and keep working.
- [ ] PL-16.2 Each provider adapter sends the provider's documented request and maps its answer and errors, proven against SendMock's own emulation of that provider.
- [ ] PL-16.3 A real send to a recipient outside the connection's allowed list, or on its blocked list, is refused before any request leaves; a connection with no allowed recipients sends nothing.
- [ ] PL-16.4 Connection secrets are masked in the UI, API answers, logs and MCP results, and seed exports hold only environment references.
- [ ] PL-16.5 Test connection checks the credentials, Send a test sends one message to an allowed recipient, and the connection shows its last success and last error.
- [ ] PL-16.6 `--real-delivery off` (`SENDMOCK_REAL_DELIVERY`) stops every real send from connections, release and rules, and the UI shows a banner while it is off.
- [ ] PL-16.7 Send for real on an email or an SMS sends it through a chosen connection to recipients on its allowed list and records it in the message's timeline.

## PL-17 Forwarding rules for email and SMS

After 1.0, planned 2026-11-08 by owner request, for later. Plan: [32-after-1-0.md](../32-after-1-0.md#a14-real-forwarding-provider-connections-and-routing-rules-for-email-and-sms-pl-16-pl-17) (A14b).

- [ ] PL-17.1 Email and SMS forwarding rules are listed, created, edited, reordered, switched on and off and deleted through Settings > Forwarding, REST, CLI, MCP and the seed file; the existing email auto-forward rules move over unchanged and their commands keep working.
- [ ] PL-17.2 A rule's filter matches on project, direction, from, to, subject or body, the provider API used, email tags and headers and the presence of an OTP, with the webhook rules' operators.
- [ ] PL-17.3 A rule sends to the original recipients that its connection allows (dropping and noting the rest) or redirects to fixed recipients, with the chosen prefix, sender and Message-ID options.
- [ ] PL-17.4 Rules run in order, a rule marked stop at this rule ends the list for a matching message, and every other matching rule sends.
- [ ] PL-17.5 Per-rule per-minute and per-day caps and a per-connection per-day cap skip and record forwards past the limit; dry run lists what a rule would have forwarded from the last 100 messages without sending.
- [ ] PL-17.6 Each forward records its status, provider message id and error, is retried on network, rate-limit and server errors but not on refused recipients or bad credentials, shows in the message's timeline and the Logs screen's Forwards tab, and fires `email.forwarded`, `sms.forwarded` or `forward.failed`.
- [ ] PL-17.7 A forwarded email that comes back is never forwarded again, and a rule cannot target SendMock's own SMTP address or provider APIs.
- [ ] PL-17.8 CI forwards email and SMS through every adapter to a second SendMock acting as the real provider.
