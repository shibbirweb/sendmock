# Acceptance: Webhooks (WH)

Plan: [05-webhooks.md](../05-webhooks.md), [12-webhook-variables.md](../12-webhook-variables.md), [13-webhook-templates.md](../13-webhook-templates.md). Rules for IDs, ticking and tests: [README.md](README.md).

## WH-01 Endpoints

UI in U2, backend Phase 3.

- [ ] WH-01.1 Endpoints can be created, edited, disabled and deleted from UI, API, CLI, MCP and the seed file.
- [ ] WH-01.2 "Send test" delivers `test.ping` and shows the response.
- [ ] WH-01.3 Secrets are write-only: masked in UI, API, logs and MCP; "reveal" requires confirmation.
- [ ] WH-01.4 A `localhost` URL while running in Docker shows the `host.docker.internal` hint.
- [ ] WH-01.5 Timeout (1 to 60 s), max attempts (1 to 10) and retry delays (1 s to 24 h) are validated the same way in the UI and API, and the sheet previews the attempt schedule.
- [ ] WH-01.6 A template's required variables show as missing until they are set as endpoint or global variables (endpoint ones win); names with token, secret, key or password are stored as masked secrets.
- [ ] WH-01.7 The endpoints table shows each endpoint's 24-hour success sparkline with the rate as text, and the enabled switch applies at once.
- [ ] WH-01.8 Rotating the secret shows the new masked secret and until when the old one stays valid.

## WH-02 Rules and filters

UI in U2, backend Phase 3.

- [ ] WH-02.1 A rule fires only for its selected events and only when its filter matches.
- [ ] WH-02.2 Every documented field, operator (`equals`, `contains`, `starts_with`, `matches`, `regex`, `exists`) and combinator (`all`, `any`, `not`) evaluates correctly.
- [ ] WH-02.3 The preview shows exactly which of the last 50 messages would match.
- [ ] WH-02.4 Disabled rules never fire; rule order is respected.
- [ ] WH-02.5 The builder checks every condition the same way as the API (field, value unless `exists`, valid regex, header name) and round-trips every filter the API accepts (`all`, `any`, `not`, one nested group).
- [ ] WH-02.6 The rules list shows firing order, endpoint, events and a plain-language filter summary; rules can be reordered, switched on and off at once and filtered by endpoint.

## WH-03 Delivery engine and retries

UI in U2 (WH-03.7 to WH-03.9), backend Phase 3.

- [ ] WH-03.1 Ingest (SMTP, SMS API) never waits for webhook delivery.
- [ ] WH-03.2 `5xx`, timeouts and connection errors are retried with the configured backoff up to max attempts; `4xx` are not (unless configured).
- [ ] WH-03.3 Pending deliveries and retries survive a restart.
- [ ] WH-03.4 Exhausted deliveries fire `webhook.failed`; cancelled deliveries stop retrying.
- [ ] WH-03.5 Each attempt stores the full request and the response (body truncated at 64 KB with a flag), duration and error.
- [ ] WH-03.6 Concurrency never exceeds the configured limit.
- [ ] WH-03.7 The deliveries log shows time, event, endpoint, trigger, status, duration and attempt, narrows by status, endpoint and event, loads 50 rows at a time and shows new deliveries as they happen.
- [ ] WH-03.8 A delivery's detail shows request and response side by side with formatted bodies and the truncation note, lists every attempt of the event, links to the message that caused it and copies the request as cURL.
- [ ] WH-03.9 "Cancel retries" marks a retrying delivery cancelled so it never runs again; a `render_failed` delivery shows the template error instead of a request.

## WH-04 Standard Webhooks signing

Phase 3. Docs: [Signing](../05-webhooks.md#signing).

- [ ] WH-04.1 Native deliveries carry `webhook-id`, `webhook-timestamp` and `webhook-signature` exactly as the Standard Webhooks spec defines, and verify with the official libraries in at least Node, Python, PHP and Go.
- [ ] WH-04.2 `webhook-id` stays the same across retries of one event.
- [ ] WH-04.3 Secret rotation signs with both secrets during the overlap window, then only with the new one.

## WH-05 Manual send and replay

UI in U2, backend Phase 3.

- [ ] WH-05.1 "Send to webhook" from any email or SMS sends it to the chosen endpoint and template.
- [ ] WH-05.2 Replay as-is resends the stored request; Re-render uses fresh variables; Edit and replay sends the edited body.
- [ ] WH-05.3 The composer sends a hand-written request using any template preset.
- [ ] WH-05.4 API (`/send`, `/replay`) and CLI (`sendmock webhook send`) trigger the same behaviour, including variable overrides.

## WH-06 Provider formats and signatures

Phase 3 (Twilio, Vonage), Phase 4 (email providers).

- [ ] WH-06.1 Each provider format matches the fixtures built from that provider's docs (fields, content type, encoding).
- [ ] WH-06.2 Provider signatures (Twilio, Mailgun, SendGrid, Slack) verify with that provider's official SDK helper.
- [ ] WH-06.3 Inbound email formats include attachments as the provider sends them.

## WH-07 Variables and templating

UI in U2 (nunjucks preview), backend Phase 3 (`minijinja`), Phase 4 (fake data, aliases, env).

- [ ] WH-07.1 Every variable kind (Text, Number, Boolean, JSON, Secret, Dynamic, Random, Computed, Prompt) resolves correctly.
- [ ] WH-07.2 Scope precedence is send-time, then endpoint, then global, then `SENDMOCK_VAR_*`.
- [ ] WH-07.3 Every documented function and filter returns the documented output (table-driven tests).
- [ ] WH-07.4 Random values stay the same across retries of one delivery and change on re-render; Fixed values change only on Regenerate.
- [ ] WH-07.5 Strict mode stops a delivery with `render_failed` and a clear error; lenient mode renders empty values and logs a warning.
- [ ] WH-07.6 Fields mode always produces valid JSON, form or multipart bodies.
- [ ] WH-07.7 Templates cannot read files, network or environment, and a runaway template is stopped by the fuel/time limit.
- [ ] WH-07.8 The live preview matches what is actually sent for the same message.

## WH-08 Built-in payload templates

Phase 3 (Twilio, Vonage, Slack, Discord, native), Phase 4 (the rest).

- [ ] WH-08.1 Every built-in template in the catalogue renders against its sample and against a real event of each declared type.
- [ ] WH-08.2 Choosing a template asks for its required variables.
- [ ] WH-08.3 The gallery filters by category, service and event.

## WH-09 Custom templates

UI in U2, backend Phase 3 (create, clone, linked/detached), Phase 4 (import/export, directory, revisions).

- [ ] WH-09.1 Templates can be created, cloned from built-ins and saved from an endpoint.
- [ ] WH-09.2 Linked endpoints pick up template changes; detached ones do not.
- [ ] WH-09.3 Export then import produces an identical template; secrets are never exported.
- [ ] WH-09.4 `--templates-dir` loads templates at startup and reloads them on change.
- [ ] WH-09.5 Revisions keep the last 20 versions with diff and restore; invalid templates cannot be saved.
- [ ] WH-09.6 Deleting a template in use requires choosing detach or cancel.

## WH-10 Saved deliveries

Phase 3.

- [ ] WH-10.1 Any delivery or composer request can be saved with a name, and survives pruning and `reset`.
- [ ] WH-10.2 A saved delivery can be resent to any endpoint and turned into a template.
- [ ] WH-10.3 Saved deliveries are included in seed export.

## WH-11 Webhook metrics

UI in U1/U2, backend Phase 3.

- [ ] WH-11.1 Overview and Webhooks show deliveries over time, success rate, p50/p95 latency and top failure codes per endpoint.
- [ ] WH-11.2 `/api/v1/stats` numbers match the delivery log.

## WH-12 Inbound routes (Mailgun style)

UI in U2, backend Phase 4. Docs: [Email replies and inbound routes](../05-webhooks.md#email-replies-and-inbound-routes-mailgun-style).

- [ ] WH-12.1 Routes support `match_recipient` (named groups usable as `\g<name>` in actions), `match_header` and `catch_all`, run in priority order, and stop after `stop()`.
- [ ] WH-12.2 `forward(url)` posts Mailgun's multipart fields, attachments included, with a `signature` that verifies with Mailgun's documented algorithm; a URL ending in `mime` gets `body-mime`.
- [ ] WH-12.3 `stripped-text` and `stripped-signature` leave out the quoted original and the signature block.
- [ ] WH-12.4 A `406` response is not retried, other non-2xx responses follow the endpoint's retry policy, and every forward appears in the delivery log and the email timeline.
- [ ] WH-12.5 `forward(email)` only sends to addresses on the release allowlist; `store(notify)` posts a `message-url`, and `GET` on it returns the message.
- [ ] WH-12.6 Routes created through the Mailgun Routes API (`/v3/routes`) on the provider port behave like routes created in the UI.
