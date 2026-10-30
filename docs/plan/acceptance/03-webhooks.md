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
- [ ] WH-05.5 Send to webhook and the composer ask for every Prompt variable in scope, prefilled with its default, and take per-send overrides that win over endpoint and global values for that send only; the preview shows the result before sending.
- [ ] WH-05.6 The rendered body can be edited before a manual send and is then sent as written; a render error blocks sending; the result links to the new `manual` delivery and can be saved with a name.

## WH-06 Provider formats and signatures

Phase 3 (Twilio, Vonage), Phase 4 (email providers).

- [ ] WH-06.1 Each provider format matches the fixtures built from that provider's docs (fields, content type, encoding).
- [ ] WH-06.2 Provider signatures (Twilio, Mailgun, SendGrid, Slack) verify with that provider's official SDK helper.
- [ ] WH-06.3 Inbound email formats include attachments as the provider sends them.

## WH-07 Variables and templating

UI in U2 (nunjucks preview), backend Phase 3 (`minijinja`), Phase 4 (fake data, aliases, env, multipart).

- [ ] WH-07.1 Every variable kind (Text, Number, Boolean, JSON, Secret, Dynamic, Random, Computed, Prompt) resolves correctly.
- [ ] WH-07.2 Scope precedence is send-time, then endpoint, then global, then `SENDMOCK_VAR_*`.
- [ ] WH-07.3 Every documented function and filter returns the documented output (table-driven tests).
- [ ] WH-07.4 Random values stay the same across retries of one delivery and change on re-render; Fixed values change only on Regenerate.
- [x] WH-07.5 Strict mode stops a delivery with `render_failed` and a clear error; lenient mode renders empty values and logs a warning.
- [ ] WH-07.6 Fields mode always produces valid JSON or form bodies.
- [x] WH-07.7 Templates cannot read files, network or environment, and a runaway template is stopped by the fuel/time limit.
- [ ] WH-07.8 The live preview matches what is actually sent for the same message.
- [ ] WH-07.9 The reference panel lists every context field for the chosen events, the variables, functions and filters with type, description and example, and clicking one inserts it at the cursor.
- [ ] WH-07.10 Typing inside `{{ }}` suggests matching keys, the children after a dot, filters after `|` and functions with their signature; the keyboard picks and inserts one.
- [ ] WH-07.11 The Variables screen lists global and endpoint variables with kind, value (secrets masked) and scope, and narrows them by scope, kind and name.
- [ ] WH-07.12 Each kind has its own editor fields, checked the same way by the UI and the API (number, boolean, valid JSON, expressions that render), with a "Resolves to" preview against the sample; a secret is never shown again after saving.
- [ ] WH-07.13 A Random variable is Per send or Fixed; a Fixed one shows its current value and Regenerate replaces it.
- [ ] WH-07.14 The request editor sets query params, headers and a body as Template, Fields, Raw or None, plus Strict or Lenient rendering; Fields always encode a valid JSON or form body, and Raw uses the code editor with highlighting, `{{` completion, hover values and an Insert menu.
- [ ] WH-07.15 The live preview renders the method, URL, headers and body against the sample or a chosen message as you type, and each error or warning shows under the part it comes from and, in the code editor, at its line and column.
- [ ] WH-07.16 Fields mode can also send `multipart/form-data`, with file fields streamed from a URL. (Split from WH-07.6 on 2026-10-30: the contract and request editor built in Stage A have only JSON and form encodings, and multipart arrives in Phase 4 with the SendGrid Inbound Parse and Mailgun routes formats that use it.)

## WH-08 Built-in payload templates

UI in U2, backend Phase 3 (Twilio, Vonage, Slack, Discord, native), Phase 4 (the rest).

- [ ] WH-08.1 Every built-in template in the catalogue renders against its sample and against a real event of each declared type.
- [ ] WH-08.2 Choosing a template asks for its required variables.
- [ ] WH-08.3 The gallery filters by category, service and event.
- [ ] WH-08.4 A template's detail shows its description, events, required variables, request shape and provider doc link with the verified date, and previews the rendered request against a chosen recent message or the built-in sample, listing undefined variables as warnings.
- [ ] WH-08.5 "Use in new endpoint" opens the endpoint sheet with the template chosen.

## WH-09 Custom templates

UI in U2, backend Phase 3 (create, clone, linked/detached), Phase 4 (import/export, directory, revisions).

- [ ] WH-09.1 Templates can be created, cloned from built-ins and saved from an endpoint.
- [ ] WH-09.2 Linked endpoints pick up template changes; detached ones do not.
- [ ] WH-09.3 Export then import produces an identical template; secrets are never exported.
- [ ] WH-09.4 `--templates-dir` loads templates at startup and reloads them on change.
- [ ] WH-09.5 Revisions keep the last 20 versions with diff and restore; invalid templates cannot be saved.
- [ ] WH-09.6 Deleting a template in use requires choosing detach or cancel.
- [ ] WH-09.7 Built-in and custom templates can be edited (method, content type, header and body templates) with the preview following the draft; errors block saving, undefined variables are warnings, and file templates stay read-only.
- [ ] WH-09.8 An edited built-in shows a Modified badge and is used by every endpoint that links it; Reset to default asks first and restores the shipped template.
- [ ] WH-09.9 A new blank template can be created, and a custom template's name, description, events and required variables can be edited; built-in templates keep their own.

## WH-10 Saved deliveries

UI in U2, backend Phase 3.

- [ ] WH-10.1 Any delivery or composer request can be saved with a name, and survives pruning and `reset`.
- [ ] WH-10.2 A saved delivery can be resent to any endpoint and turned into a template.
- [ ] WH-10.3 Saved deliveries are included in seed export.
- [ ] WH-10.4 The Saved screen lists saved deliveries newest first with their stored request, searches them by name, and renames and deletes them.

## WH-11 Webhook metrics

UI in U1/U2, backend Phase 3.

- [ ] WH-11.1 Overview and Webhooks show deliveries over time, success rate, p50/p95 latency and top failure codes per endpoint.
- [ ] WH-11.2 `/api/v1/stats` numbers match the delivery log.
- [ ] WH-11.3 The Webhooks overview narrows to 24 hours or 7 days and to one endpoint; its chart stacks succeeded, retrying and failed deliveries per hour or day with a legend, a tooltip with p50 / p95 latency and a table view, beside the totals, per-endpoint metrics, top failure codes and recent failures.

## WH-12 Inbound routes (Mailgun style)

UI in U2, backend Phase 4. Docs: [Email replies and inbound routes](../05-webhooks.md#email-replies-and-inbound-routes-mailgun-style).

- [ ] WH-12.1 Routes support `match_recipient` (named groups usable as `\g<name>` in actions), `match_header` and `catch_all`, run in priority order, and stop after `stop()`.
- [ ] WH-12.2 `forward(url)` posts Mailgun's multipart fields, attachments included, with a `signature` that verifies with Mailgun's documented algorithm; a URL ending in `mime` gets `body-mime`.
- [ ] WH-12.3 `stripped-text` and `stripped-signature` leave out the quoted original and the signature block.
- [ ] WH-12.4 A `406` response is not retried, other non-2xx responses follow the endpoint's retry policy, and every forward appears in the delivery log and the email timeline.
- [ ] WH-12.5 `forward(email)` only sends to addresses on the release allowlist; `store(notify)` posts a `message-url`, and `GET` on it returns the message.
- [ ] WH-12.6 Routes created through the Mailgun Routes API (`/v3/routes`) on the provider port behave like routes created in the UI.
- [ ] WH-12.7 Webhooks > Inbound routes lists routes by priority with their expression and actions; the editor builds the filter and actions in Mailgun syntax with a live "matches N of the last 50 incoming emails" preview showing captured groups and regex errors; routes can be reordered and deleted, and an incoming email runs the matching routes in order until `stop()`, each forward shown in its timeline and the delivery log.
