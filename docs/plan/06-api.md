# 06. HTTP API

Base path: `/api/v1`. JSON in and out. The OpenAPI 3.1 document is served at `/api/openapi.json` and drives both the UI's TypeScript types and the user-facing API docs page.

## Contract

The contract is [docs/api/openapi.yaml](../api/openapi.yaml), frozen in Phase U3 ([18](18-phase-u3.md#w7-contract-freeze-ui-09)). It is generated, never edited by hand: `web/src/lib/api/endpoint-registry` lists every endpoint (method, path, summary, parameters, body, answer, errors) and the schemas come from the TypeScript types in `web/src/lib/api/types` (`bun run openapi` in `web/`). Tests keep it honest: the registry must equal the mock handlers, and the committed file must equal a fresh build and validate as OpenAPI 3.1. From the freeze on, an API change starts here in the plan, then the registry or types, then the spec. In Stage B the backend generates its document with `utoipa` and the contract tests (PL-01.1) compare it with this file.

The spec covers every endpoint: the ones the UI uses, the `/catch/{binPath}` capture URL, and (since U3 W14, [20](20-surface-parity.md)) the ones that were planned for the CLI and MCP only: the test-automation helpers (`/wait/*`, `/otp`, `/links`), `GET /emails/latest`, `POST /emails/inbound`, `POST /send/raw`, `/tag-rules`, `/forward-rules`, the outcome tests, the payments test cards ([17](17-payments.md#api-sendmock-native)), `GET /events/recent`, `/integrations/{stack}`, `/scenarios` and `/ai`. Every operation also names its CLI command, MCP tool and UI place in the surface catalogue (`web/src/lib/api/surface-catalogue`), written into the spec as `x-sendmock-cli`, `x-sendmock-mcp` and `x-sendmock-ui`. Earlier ideas that the existing endpoints already answer are dropped: an email's HTML is in `GET /emails/{emailId}` (`html_body`), opens are in its timeline (and `opened_at` on an SMS), and rendering without sending is `POST /webhooks/endpoints/preview`. The realtime stream (`/ws`, SSE `/events`) is not described by OpenAPI; `GET /events/recent` is its polling twin.

Aliases: `GET /api/v1/sms/send?from=&to=&body=` runs `POST /api/v1/sms` from the query string, for apps written for regional vendors' query-string APIs; it is logged like the POST and left out of OpenAPI (one `operationId` per operation). Every `POST`, `PUT` and `PATCH` also takes `application/x-www-form-urlencoded` bodies.

Auth: none by default; when `--ui-auth` is set, the same basic auth (or an API token from settings) protects the API.

CORS: `--cors-origins` (default: the official docs site origin, so the website's API playground can reach a local instance after the user clicks Connect; set to empty to disable). See [16-website-and-releases.md](16-website-and-releases.md#api-playground).

## Email

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/emails` | list, cursor pagination (`?cursor=&limit=`), filters (`query`, `from`, `to`, `tag`, `is_unread`, `has_attachment`, `source`, `direction`) |
| GET | `/emails/{emailId}` | parsed message (headers, text, html, attachments meta, extracted data) |
| GET | `/emails/{emailId}/raw` | original `.eml` |
| GET | `/emails/{emailId}/mime/{partId}` | download one MIME part, decoded, by its position in the MIME tree (`1.2`) |
| GET | `/emails/{emailId}/html` | sanitised HTML for preview iframe |
| GET | `/emails/{emailId}/attachments/{attachmentIndex}` | download attachment |
| PATCH | `/emails/{emailId}` | mark read/unread, set tags |
| POST | `/emails/{emailId}/open` | record an open and fire `email.opened`; body `{ "source": "ui" \| "manual" \| "api", "user_agent"? }` (default `api`); a `ui` open the opened-events settings leave out records nothing and still answers 204 |
| GET | `/emails/{emailId}/opens` | open history, oldest first: `opened_at`, `source`, `user_agent` |
| DELETE | `/emails/{emailId}` | delete one |
| DELETE | `/emails` | delete all, or only those matching the list's filters (`query`, `from`, `to`, `tag`, `is_unread`, `has_attachment`, `source`, `direction`, and `project` since A17); answers 204 and publishes one `traffic.cleared` |
| GET | `/emails/latest` | newest message, optionally filtered by `to` |
| POST | `/send` | native HTTP send (JSON, with base64 `attachments`, see [03-email.md](03-email.md#native-send-attachments)); provider-compatible send APIs live under `/providers/*` and the provider port ([03-email.md](03-email.md#http-send-apis)) |
| POST | `/emails/{emailId}/simulate` | simulate `delivered`, `deferred`, `bounced` (hard/soft), `complained`, `unsubscribed` |
| GET | `/emails/{emailId}/timeline` | received, opened, delivery outcomes, releases, webhooks |
| GET | `/emails/{emailId}/mime` | MIME tree |
| GET | `/emails/{emailId}/parts/{attachmentIndex}/thumbnail` | image thumbnail |
| GET | `/emails/{emailId}/html-check` | HTML/CSS client compatibility report |
| POST | `/emails/{emailId}/link-check` | check links and images (outbound requests) |
| POST | `/emails/{emailId}/spam-check` | SpamAssassin score (when configured) |
| GET | `/emails/{emailId}/list-unsubscribe` | List-Unsubscribe header validation |
| POST | `/emails/{emailId}/release` | send to a real SMTP relay (`{ "to": [...] }` optional) |
| POST | `/emails/{emailId}/reply`, `/emails/{emailId}/forward` | reply to or forward an email as its recipient; the result is stored as an inbound email and fires `email.inbound` ([03](03-email.md)) |
| GET/POST/PATCH/DELETE | `/inbound-routes` | Mailgun-style routes for incoming email, in priority order; `POST /inbound-routes/test` shows which routes match and what runs ([05](05-webhooks.md#email-replies-and-inbound-routes-mailgun-style)) |
| POST | `/inbound-routes/match` | where an incoming email would go (W20, EM-22): `{ "to": [...], "cc": [...], "headers": { "subject": "..." } }` answers `routes` (each matching route in run order with its actions, ending at one that calls `stop()`) and `webhook_rules` (each enabled rule on `email.inbound` whose filter matches, with its endpoint's name and URL); nothing is sent or stored |
| GET/POST/PATCH/DELETE | `/tag-rules`, `/forward-rules` | automatic tagging and auto-forward rules (a filter, as in webhook rules, and the tag or the addresses to forward to); `POST /tag-rules/{ruleId}/move` and `/forward-rules/{ruleId}/move` reorder |
| GET | `/emails/latest?to=&subject=` | the newest email to a recipient (404 when none) |
| POST | `/emails/inbound` | create an incoming email from fields or raw MIME; fires `email.inbound` ([05](05-webhooks.md#simulating-replies-and-forwards)) |
| POST | `/send/raw` | store a raw message (`message/rfc822`) as sent by your app, as the `sendmail` shim does |
| POST | `/outcome-rules/email/test`, `/outcome-rules/sms/test` | which custom rule, magic address or number, or profile applies to an address or number |
| GET/POST/PATCH/DELETE | `/outcome-rules/email` | custom outcome addresses; `POST /outcome-rules/email/{ruleId}/move` with `up` or `down` reorders |
| GET/POST/PATCH/DELETE | `/emails/providers`, `/emails/providers/{providerKey}` | email provider definitions: list, add (blank or from a built-in), change, remove a built-in or delete a custom one ([22](22-configurable-providers.md)) |
| POST | `/emails/providers/{providerKey}/restore`, `/reset`, `/preview` | bring a removed built-in back, put a built-in back as shipped, run a sample request through a definition |
| GET | `/emails/providers/{providerKey}/credentials/{credentialName}` | reveal one secret credential (UI and CLI, after a confirmation; never over MCP) |

## SMS

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/sms` | native send, with optional `media_urls` and inline base64 `media` (see [04-sms.md](04-sms.md#mms-and-media)) |
| GET | `/sms` | list, filters (`query`, `to`, `from`, `status`, `direction`, `thread_id`) |
| GET | `/sms/{smsId}` | one message with status history |
| GET | `/sms/{smsId}/media/{mediaIndex}` | one stored media file (MMS or WhatsApp), with its content type |
| GET | `/sms/threads` | conversations grouped by number pair; `unread_count` counts the conversation's unread messages (A17) |
| PATCH | `/sms/threads/{threadId}` | `{ "is_read": true }` marks every message in the conversation read (opening it in the UI does this); `false` marks its newest message unread (A17, UI-14) |
| DELETE | `/sms/threads/{threadId}` | delete a conversation with its messages, media and history (A17, UI-14) |
| POST | `/sms/{smsId}/status` | manually set status (manual profile) |
| POST | `/sms/{smsId}/open` | record a simulated read and fire `sms.opened` (outbound only, 409 `inbound_sms` for inbound); same body and settings as the email open |
| GET | `/sms/{smsId}/opens` | read history, oldest first |
| POST | `/sms/inbound` | simulate incoming SMS |
| POST | `/sms/{smsId}/reply-webhook/resend` | send an inbound message's reply webhook again (Twilio-style request URL, fallback and TwiML replies) |
| DELETE | `/sms/{smsId}`, `/sms` | delete one / all (`project` since A17; all publishes one `traffic.cleared`) |
| GET/POST/PATCH/DELETE | `/numbers` | virtual number registry |
| GET/POST/PATCH/DELETE | `/outcome-rules/sms` | custom outcome numbers; `POST /outcome-rules/sms/{ruleId}/move` with `up` or `down` reorders |
| GET/POST/PATCH/DELETE | `/messaging-services` | Twilio-style Messaging Services (sender pools) |
| GET/POST/PATCH/DELETE | `/twilio/subaccounts`, `/twilio/subaccounts/{accountSid}` | subaccounts of the Twilio provider's main account: name, status (`active`, `suspended`, `closed`), auth token (masked in answers; empty or masked on `PATCH` keeps it) and Debugger webhook URL (A23, SM-19) |
| GET | `/twilio/subaccounts/{accountSid}/auth-token` | reveal a subaccount's token (UI and CLI only, never MCP) |
| GET | `/mailgun/complaints` | addresses on each Mailgun sending domain's complaints table; `domain` filters (A23, EM-23) |
| DELETE | `/mailgun/complaints/{domain}` | clear one domain's complaints table |
| GET/POST/PATCH/DELETE | `/sms/providers`, `/sms/providers/{providerKey}` | SMS provider definitions, as for email providers ([22](22-configurable-providers.md)) |
| POST | `/sms/providers/{providerKey}/restore`, `/reset`, `/preview` | as for email providers |
| GET | `/sms/providers/{providerKey}/credentials/{credentialName}` | reveal one secret credential (UI and CLI only) |

## Verify

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST/PATCH/DELETE | `/verify/services` | Verify services (code length, fixed code, TTL) |
| GET | `/verify` | verifications list (filters `to`, `status`, `channel`) |
| GET | `/verify/{verificationSid}` | one verification with code, attempts, timeline |
| POST | `/verify/{verificationSid}/force` | force `approved`, `canceled`, `expired`, `max_attempts` |
| DELETE | `/verify/{verificationSid}`, `/verify` | delete one verification, or all (the list's `to`, `status`, `channel` and `project` filters narrow it) with their check attempts (A17, UI-14) |

The Twilio Verify wire API itself (`/v2/Services/...`) is served on the provider port ([04-sms.md](04-sms.md#twilio-verify)).

## HTTP catcher

| Method | Path | Purpose |
|--------|------|---------|
| ANY | `/catch/{bin}/*` | capture any request (outside `/api/v1`, see [15-http-catcher.md](15-http-catcher.md)) |
| GET/POST/PATCH/DELETE | `/http/bins` | bins: `POST` takes `{ "name": ..., "preset": ... }` (`409` when the name is taken), `PATCH` the `default_response`; `DELETE` removes the bin and its requests |
| GET/PUT | `/http/bins/{binId}/responses` | the bin's response rules, in order; `PUT` replaces the list (order, enabled, edits) |
| POST | `/http/bins/{binId}/responses/preview` | `{ "rule": ..., "request_id": ... }`: whether the rule matches that captured request, and the rendered response with template problems |
| GET | `/http/requests`, `/http/requests/{requestId}` | captured requests (`?bin_id=`), newest first, paged; each with the response sent and the rule that produced it |
| DELETE | `/http/requests?bin_id=` | clear a bin's requests, or every bin's without `bin_id` (publishes one `traffic.cleared`) |
| PATCH | `/http/requests/{requestId}` | `{ "is_read": false }` marks a captured request unread, `true` read; requests arrive unread and opening one marks it read (A17, UI-14) |
| DELETE | `/http/requests/{requestId}` | delete one captured request with its uploaded files (A17, UI-14) |
| GET | `/http/requests/{requestId}/files/{fileIndex}` | download a file uploaded in a multipart request |
| POST | `/http/requests/{requestId}/forward` | resend a captured request to `{ "url": ... }`; returns the status, duration and body it got |
| GET | `/provider-bins` | which HTTP Catcher bin answers each provider's unmatched requests: area (`email`, `sms`, `push`, `payments`), provider key, bin (A23, PL-21) |
| PUT/DELETE | `/provider-bins/{area}/{providerKey}` | send the provider's unmatched requests to `{ "bin_name": ... }` (made if new), or answer them with the provider's `404` again; response rules gain `follow_up` (`url` template or `endpoint_id`, `template_id`, `delay_ms`), captured requests `provider_key`, API log entries `catcher_answer` |

## Payments

Native payments, hosted checkout, simulate actions (Phase 4 adds `answer_dispute` with `dispute_evidence`, the dispute's `under_review` status and `evidence`, and the `payment.dispute_updated` event; and subscriptions at `/payments/subscriptions` with advance and cancel and the `subscription.*` events), resend IPN, test cards and `wait/payment`; provider wire APIs (Stripe, PayPal, SSLCommerz, ...). Since A17 (UI-14): `DELETE /payments/{paymentId}` and `DELETE /payments` (the list's filters narrow it) delete payments with their events, refunds and checkout sessions, and `DELETE /payments/subscriptions/{subscriptionId}` and `DELETE /payments/subscriptions` delete subscriptions; gateways, methods and flows stay. are on the provider port. Full table in [17-payments.md](17-payments.md#api-sendmock-native).

## Logs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/logs/smtp`, `/logs/smtp/{sessionId}` | SMTP sessions with full transcripts (incl. failed sessions) |
| GET | `/logs/http`, `/logs/http/{requestId}` | requests to native and provider APIs, including rejected ones |
| DELETE | `/logs/smtp/{sessionId}`, `/logs/smtp` | delete one SMTP session, or all (the list's filters narrow it) (A17, UI-14) |
| DELETE | `/logs/http/{requestId}`, `/logs/http` | delete one API request log entry, or all (the list's filters narrow it) (A17, UI-14) |

## Webhooks

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST/PATCH/DELETE | `/webhooks/endpoints` | manage endpoints (URL, `query_params`, headers, `body_mode` with its fields, raw body or template, `render_mode`); the list adds `delivery_count_24h` and `success_history` (24 hourly success rates, `null` for hours without deliveries) |
| POST | `/webhooks/endpoints/preview` | render an unsaved endpoint request (URL, query params, headers, body in any mode, render mode) against the sample or `email_id` / `sms_id`, with optional send-time `variables`; with `endpoint_id` alone it renders that saved endpoint as stored (`sendmock webhook render --endpoint-id <endpointId>`); returns the rendered request and problems, each with where it comes from and, for templates, its line and column |
| POST | `/webhooks/endpoints/{endpointId}/test` | send `test.ping` |
| POST | `/webhooks/endpoints/{endpointId}/send` | manual send: `email_id` or `sms_id` (or neither for the sample), optional `template_id` (format for this send), `request` (a hand-written request: method, URL, query params, headers, body mode and render mode, replacing the endpoint's), `variables` (send-time overrides) and `body` (an edited body, sent as written); returns the `manual` delivery, `render_failed` when rendering stops it |
| GET | `/webhooks/metrics?range=24h\|7d&endpoint_id=` | delivery health for the range: totals (deliveries, success rate, p50 / p95 latency, retries, render failures), hourly or daily buckets (succeeded, retrying, failed, p50 / p95), per-endpoint metrics, top failure codes and recent failures |
| GET/POST/PATCH/DELETE | `/webhooks/rules` | manage rules |
| POST | `/webhooks/rules/preview` | which of the last 50 messages a filter would match: body `{ "events": [...], "filter": {...} }`, returns `checked_count`, `match_count` and the messages with `is_match` |
| POST | `/webhooks/rules/match` | which webhooks an event would trigger before an action fires it (W22, WH-13): `{ "event_type": "email.bounced", "subject_id": "...", "data": { "to": ["..."] } }` answers `webhook_rules`, each enabled rule on the event whose filter passes, in rule order, with its endpoint's id, name and URL; `data` stands in for a message not stored yet and wins over the stored fields; nothing is sent or stored. The simulating operations (Simulate, open, click, reply, forward, incoming email, samples, SMS status, open and inbound, payment Simulate) take `webhook_endpoint_ids` to send their events to exactly those endpoints instead (`trigger: chosen`; an empty list sends none; an unknown or disabled endpoint answers `422` naming it) |
| POST | `/webhooks/rules/match` | which webhooks an event would trigger (W22, WH-13): `{ "event_type": "email.bounced", "subject_id": "..." }`, or `data` with the fields of a message that does not exist yet, answers the enabled rules that match in rule order with each endpoint's id, name and URL, and with `include_requests: true` each endpoint's rendered request (method, URL, headers with secrets masked, body; W23, WH-14); nothing is stored or sent. Every UI simulation operation also accepts `webhook_endpoint_ids` to deliver to exactly those endpoints instead, and `webhook_requests` (`endpoint_id`, edited `body`, `headers`) to send an edited payload, signed over the edited body (W23, WH-14) ([05](05-webhooks.md#shown-and-chosen-on-every-simulation)) |
| POST | `/webhooks/rules/{ruleId}/move` | reorder: `{ "direction": "up" }` or `"down"` |
| GET | `/webhooks/deliveries` | delivery log, newest first and paged: `status` (comma-separated), `endpoint_id`, `event_type`, `subject_id` (the email, SMS or payment that caused it; W20, EM-22). Each delivery has `url`, where its request goes, known from when it is queued (null only when its request could not be rendered), so a pending delivery can name its destination (W20, EM-22.5) |
| GET | `/webhooks/deliveries/{deliveryId}` | full request and response, plus `max_attempts`, the other attempts of the same event and the email or SMS that caused it |
| POST | `/webhooks/deliveries/{deliveryId}/replay` | resend: `{ "rerender": false }` as-is, `true` with fresh variables (`409 gateway_notification` for a payment gateway's notification, which is resent from the payment), or with `body` and `headers` to send an edited request; returns the new delivery |
| POST | `/webhooks/deliveries/{deliveryId}/cancel` | stop pending retries |
| DELETE | `/webhooks/deliveries/{deliveryId}` | delete a finished delivery; `409 delivery_in_flight` while it is queued or waiting for a retry (cancel it first) (A17, UI-14) |
| DELETE | `/webhooks/deliveries` | delete every finished delivery, or those the list's `status`, `endpoint_id` and `event_type` filters match; queued and retrying ones stay (A17, UI-14) |
| GET/POST/PATCH/DELETE | `/webhooks/variables` | global and endpoint variables; values are checked per kind and secrets are always returned masked (an empty value on `PATCH` keeps the stored secret); a Fixed random variable carries its `fixed_value` |
| POST | `/webhooks/variables/preview` | what a variable resolves to against the sample message: `{ "kind": ..., "value": ... }`, returns the value, warnings and errors |
| POST | `/webhooks/variables/{variableId}/regenerate` | refresh a Fixed random variable |
| POST | `/webhooks/render` | render templates against a sample without sending |
| GET | `/webhooks/template-reference` | context fields (path, type, description, example, children) for `?events=`, plus functions and filters, for the reference panel and `{{` suggestions |
| GET/POST/PATCH/DELETE | `/webhooks/templates` | built-in and custom payload templates, plus `render`, `revisions`, `export`, `import` (see [13-webhook-templates.md](13-webhook-templates.md)) |
| GET | `/webhooks/templates/{templateId}` | one template: request shape (method, content type, header and body templates), required variables, doc link and verified date |
| POST | `/webhooks/templates/{templateId}/render` | render against `{ "email_id": ... }`, `{ "sms_id": ... }`, `{ "payment_id": ... }` (as the event its latest state stands for, e.g. `payment.succeeded`) or `{}` for the built-in sample, optionally with an unsaved `draft`; returns headers, body, warnings and errors |
| PATCH | `/webhooks/templates/{templateId}` | edit `method`, `content_type`, `header_templates`, `body_template` (built-in and custom; file templates are read-only), and for custom templates `name`, `description`, `events`, `required_variables`; each save keeps a revision; `422` with the errors when it does not render; an edited built-in gets `is_modified` |
| POST | `/webhooks/templates/{templateId}/reset` | restore a modified built-in to the shipped default |
| POST | `/webhooks/templates/{templateId}/clone` | custom copy: `{ "name": ... }` |
| POST | `/webhooks/templates` | new blank custom template: `{ "name": ... }` |
| POST | `/webhooks/templates/import` | `{ "file_text": ..., "on_conflict": "replace" \| "copy" }`; `409` naming the existing template when the id is taken and `on_conflict` is left out; `422` when it does not parse or render |
| GET | `/webhooks/templates/{templateId}/revisions` | the last 20 revisions, newest first, each with its request shape |
| POST | `/webhooks/templates/{templateId}/revisions/{revision}/restore` | save that revision again as a new one |
| POST | `/webhooks/endpoints/{endpointId}/save-as-template` | `{ "name": ... }`: the endpoint's template with its extra headers and body fields folded in |
| GET | `/webhooks/templates/{templateId}/export` | the template as TOML (variable declarations, never values) |
| DELETE | `/webhooks/templates/{templateId}` | custom templates only; `409` with the endpoint count while in use, unless `?endpoints=detach` (those endpoints keep a copy) |
| GET/POST/PATCH/DELETE | `/webhooks/saved` | saved deliveries (bookmarks); `POST` takes `{ "name": ..., "delivery_id": ... }`, `PATCH` renames |
| POST | `/webhooks/saved/{savedId}/send` | send again: `{ "endpoint_id": ..., "rerender": true }`; returns the new delivery |
| POST | `/webhooks/saved/{savedId}/template` | save as a custom template: `{ "name": ... }`; returns the template |
| POST | `/webhooks/endpoints/{endpointId}/rotate-secret` | rotate the Standard Webhooks secret with an overlap window (`{ "overlap_hours": 24 }`); the response carries the new masked secret and `previous_secret_expires_at` |
| GET | `/webhooks/endpoints/{endpointId}/secret` | reveal the plain secret (the reveal is written to the API request log); everywhere else secrets are masked |

Fields bodies (Phase 4, WH-07.16): `fields_encoding` also takes `multipart` (`multipart/form-data`), and a body field's `value_type` also takes `file`, whose value is a URL template. The stored request writes a file field as a part with an `X-Sendmock-File-Url` header and no content; the sender fetches the URL when it sends the request (each attempt), names the part after the URL's last path segment, takes the content type from the answer, and sends the bytes. Inbound routes use the same placeholder for an email's attachments, pointing at `GET /api/v1/emails/{emailId}/attachments/{attachmentIndex}`.

Manual send and replay accept `"variables": { ... }` overrides and `"rerender": true|false`. Details in [12-webhook-variables.md](12-webhook-variables.md).

## Test-automation helpers

These make SendMock useful from any test framework without polling loops:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/wait/email?to=user@x.test&subject=Verify&timeout=10s` | long-poll until a matching email arrives (or 408) |
| GET | `/wait/sms?to=%2B8801700000000&timeout=10s` | same for SMS |
| GET | `/wait/http?bin=slack&timeout=10s` | same for HTTP catcher requests |
| GET | `/wait/webhook?endpoint=...&status=succeeded&timeout=10s` | wait for a webhook delivery outcome |
| GET | `/otp?to=...&channel=sms\|email\|verify&timeout=10s` | latest OTP for a recipient (extracted from messages or from Twilio Verify); with `timeout`, waits for one like the wait helpers (408 on timeout), so `sendmock otp --wait 10s` is one call ([21](21-reference-and-examples.md#generated-contract-files)) |
| GET | `/links?to=...&timeout=10s` | latest extracted links for a recipient; `timeout` waits as above |
| GET | `/wait/payment?status=succeeded&timeout=10s` | same for payments |
| GET | `/events/recent?since=&type=&limit=` | the latest events, newest first: the polling twin of the realtime stream |
| GET | `/integrations/{stack}?channel=&host=` | copy-ready settings for a stack (Laravel, Django, Express, ...), as Settings > Connection shows them |
| POST | `/scenarios/validate`, `/scenarios/run` | check or run a scenario file ([14](14-ai-integration.md#scenarios)); the run answers a step-by-step report |
| GET/POST | `/scenarios` | list the saved scenarios, or save one (name, optional description, the scenario file); saving validates the file and answers 422 with its errors by step (AI-07, [32](32-after-1-0.md#saved-scenarios-ai-07)) |
| GET/PATCH/DELETE | `/scenarios/{scenarioId}` | one saved scenario: read it, rename it or change its description or file (validated as on save), or delete it |
| POST | `/scenarios/{scenarioId}/run` | run a saved scenario; answers the same report as `/scenarios/run` |
| GET | `/ai/agents`, `/ai/skill` | per AI agent the install command and MCP configuration, for the installed binary and through npx (`npx_install_command`, `npx_mcp_config`, added 2026-11-07 for AI-05.9); the agent skill as Markdown ([14](14-ai-integration.md#agent-skill)) |
| POST | `/samples/{kind}` | create a sample through the normal path: `email` (sent over SMTP to SendMock itself, so an SMTP session is logged; optional `to`, `subject`, `html`), `sms` (native send), `verification` (started on the first Verify service, or a new "Sample" service), `http` (a Slack notification to the `slack` bin); returns `{ "kind": ..., "id": ... }`. CLI `sendmock sample <kind>`, MCP `sendmock_sample_send` |
| GET, POST | `/emails/templates` | local email templates (EM-26.2, 1.5.0): list, and add one under a provider's template id or name (`EmailTemplate`: `id`, `subject`, `text`, `html`, a body required); 409 when the id exists |
| PATCH, DELETE | `/emails/templates/{templateId}` | change a template's subject or bodies (partial body), or remove it |
| POST | `/reset` | wipe traffic and restore the seed state (between test runs); from 1.5.0 (PL-26.3) it answers `ResetSummary` (`cleared` and `kept` counts by kind, `removed` and `restored_seed`) instead of 204, and the optional body `ResetRequest` takes `config: true` to also remove every configured item and restore the built-in providers, refused with 422 until `confirm_removed_count` matches the count it names |
| DELETE | `/traffic` | delete every captured item in every project (emails, SMS, verifications, push notifications, HTTP requests, finished webhook deliveries, payments, subscriptions and both logs) and keep every setting and configuration list; publishes one `traffic.cleared` (A17, UI-14) |
| POST | `/setup/export` | the configuration as a versioned setup file (A18, [32](32-after-1-0.md#a18-share-and-move-a-setup-versioned-export-and-import-pl-18)): `format` is `toml` (the default), `json` or `yaml`; `only` and `except` take section names (`webhook.endpoints`) or groups (`webhook`). Secrets are `${ENV_VAR}` references; `include_secrets` with a `passphrase` (8 characters or more) writes them encrypted. One POST, so the passphrase never travels in a URL and the CLI has one `sendmock setup export`; `GET /seed/export` stays for a plain TOML download |
| POST | `/setup/validate` | check a setup without applying it, from its text or a `url` as import takes them: the format version and whether it is upgraded, errors by line or key path, whether it holds encrypted secrets (and whether a given `passphrase` opens them), and per section what would be added, changed and removed (`mode` is `merge` or `replace`), with `removed_count` |
| POST | `/setup/import` | apply a setup: the file's text (`setup_text`), or a `url` with optional `sha256` and `headers` (fetched with the A18 limits), `format` when the text does not say, `mode` (`merge`, the default, or `replace`), `passphrase` for encrypted secrets, and for a `replace` that removes items the `confirm_removed_count` the preview showed (`setup_replace_unconfirmed` otherwise); answers what it changed, as validate lists it; 422 with the errors and nothing applied when the file is invalid, too new or too old |
| POST | `/setup/migrate` | the file upgraded to this build's format version, in the same or another `format`, without applying it |
| POST | `/seed/apply`, GET `/seed/export` | aliases of `/setup/import` (Merge, TOML) and `/setup/export` (TOML), kept so existing scripts work ([02-architecture.md](02-architecture.md#configuration-and-seed-file)) |
| POST | `/seed/validate` | alias of `/setup/validate` for a TOML file |
| GET | `/seed/status` | seed file path, when it was applied, and items added or changed since; Settings > Setup shows it as the status card |
| GET | `/stats` | totals and today's counts, 24 hourly activity buckets (emails, SMS, HTTP requests, deliveries), per-endpoint webhook metrics (deliveries, success rate, p50 / p95 latency, retries, top failure codes) and recent failed deliveries |

`wait` endpoints only match messages received after an optional `since` timestamp (defaults to "now minus 30 s") to avoid matching stale messages. In Demo mode the mock gives up after at most 3 s, so the playground stays quick.

## Settings and system

| Method | Path | Purpose |
|--------|------|---------|
| GET/PATCH | `/settings` | retention, email and SMS options, opened events, chaos toggles, OTP patterns; `PATCH` takes only the changed keys and returns field-level errors for invalid values |
| GET | `/info` | version, uptime, listeners (`provider_address`, `catcher_address`, the catch-all catcher port added in Phase 5, and `pop3_address`, added after 1.0 as A6, each null when off), counts, DB size, `is_container` (true when SendMock runs in Docker, so the UI can default to container hostnames), `available_operations` (the `operationId`s this binary serves, so the UI shows Not available yet for the rest; added to `AppInfo` in Phase 1, [07](07-ui.md#not-available-yet-stage-b)), and `warnings` (added in 1.5.0 with PL-24: sentences about setup worth fixing, such as the provider port being off; empty when there is nothing; `sendmock status` and the MCP status tool show the same list) |
| GET | `/updates` | opt-in update check against GitHub Releases for the running channel: the newest version, its date, release notes and the upgrade command for the install method; `409` while `update_check_mode` is `off`, `502` when GitHub cannot be reached |
| GET | `/health` | liveness for Docker/CI (also `sendmock health` CLI for the Docker HEALTHCHECK) |
| GET | `/tls/ca` | the local CA (path and PEM) to trust for the HTTPS provider port, 404 when SendMock has none (A23, PL-20) |

## Projects

Built after 1.0 as [32](32-after-1-0.md#a5-projects-multi-project-inboxes-pl-10) A5 (PL-10).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/projects` | every project, `default` first, each with `key`, `name`, `created_at` and its `email_count`, `sms_count` and `verification_count` |
| POST | `/projects` | add a project (`key`: lowercase letters, digits and dashes, 1 to 40 characters, starting with a letter or digit; `name`); `409 project_exists` when the key is taken |
| PATCH | `/projects/{projectKey}` | rename a project (`name`); the key never changes, since apps send it |
| DELETE | `/projects/{projectKey}` | delete a project and its emails, SMS and verifications; `409 default_project` for `default` |

Requests that capture traffic name their project in the `X-SendMock-Project` header (an unknown key answers `404 project_not_found`); without it they go to `default`. Over SMTP, an AUTH username that is a project's key picks that project. Every email, SMS and verification shows its `project`. Lists and lookups of captured traffic take an optional `project` query parameter.

## Push

Built after 1.0 as [32](32-after-1-0.md#a7-push-notifications-pn-01) A7 (PN-01). The provider APIs (FCM HTTP v1, Expo's push send and receipts, OneSignal's create notification) are answered on the provider port and under `/providers/<key>/`, like the SMS and email providers; these endpoints read what they stored.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/push` | notifications, newest first, with `project`, `device_token`, `provider` and `status` filters |
| DELETE | `/push` | delete every notification, or those the same filters match |
| GET/DELETE | `/push/{pushId}` | one notification with its request and answer; delete it |
| PATCH | `/push/{pushId}` | `{ "is_read": false }` marks a notification unread, `true` read; notifications arrive unread and opening one marks it read (A17, UI-14) |
| GET | `/wait/push` | wait for a notification to a `device_token` (and `project`) since a time; `408` on timeout |

## Realtime

`GET /api/v1/ws` (WebSocket). Server pushes event envelopes identical to the native webhook format (`{ id, type, created_at, data }`, with `data` trimmed to list-view fields). The UI uses it to update lists, counters and the delivery log live. A Server-Sent Events fallback at `/api/v1/events` is cheap to add and handy for `curl`.

Under load (W19 in [30](30-phase-5.md), 2026-11-12): the UI batches events and flushes them every 250 ms, writes list-view `data` straight into the cached first page of each list, and refetches what it cannot patch at most once per flush without cancelling a request in flight. A client that falls more than 1,024 events behind is closed with the reason `lagged`, and refetches its lists once after reconnecting.

Retention (2026-11-13, #238): when the retention task deletes traffic past the limits in Settings, it publishes `traffic.pruned` with `{ "pruned_count": n }`, and the UI refetches every live list and the stats once, since rows it placed in its cache may be gone. The event drives live views only: webhook rules cannot pick it.

Delete all (A17, UI-14): every delete-all operation and `DELETE /traffic` publish one `traffic.cleared` with `{ "kinds": ["sms"], "project": "shop", "deleted_count": n }` (`kinds` from `email`, `sms`, `verification`, `push`, `http_request`, `webhook_delivery`, `payment`, `subscription`, `smtp_session`, `api_request`; `project` null when every project was cleared) instead of one event per row, and the UI refetches the lists of those kinds and the stats. Like `traffic.pruned`, webhook rules cannot pick it.

## Conventions

**PATCH merges a partial body (1.5.0, PL-26.4):** every configuration PATCH (providers, numbers, Messaging Services, Verify services, Twilio subaccounts, inbound routes, payment flows, gateways and methods, webhook variables, HTTP bins) takes only the fields to change and merges them into the stored object, objects key by key and lists replaced; a left-out or masked secret keeps the stored value. The endpoint preview completes a partial endpoint from the saved one or a new endpoint's defaults (PL-26.5). Their request bodies are `Partial<...>` in the registry.

- Errors: `{ "error": { "code": "not_found", "message": "..." } }` with proper HTTP status.
- Times: RFC 3339 UTC strings in JSON.
- Pagination: opaque `next_cursor` (ULID based).
- Versioning: breaking changes go to `/api/v2`; `v1` stays stable once 1.0 ships.
- `POST /emails/{emailId}/clicks` (`url`, optional `user_agent`) records a click and fires `email.clicked`; `GET /emails/{emailId}/clicks` lists them; the email detail gains `click_count` (added 2026-11-07, [32](32-after-1-0.md#a2-emailclicked-link-click-tracking-em-20) A2, EM-20).
- Mailpit-compatible aliases (`/api/v1/messages`, `/api/v1/message/{ID}`, `/api/v1/search`, `/api/v1/tags`, `/view/{ID}.html`) ease migration of existing test suites: built after 1.0 as [32](32-after-1-0.md#a1-mailpit-api-compatibility-em-19) A1 (EM-19). They are compatibility routes, like the provider APIs, not operations, and are not in this spec.
