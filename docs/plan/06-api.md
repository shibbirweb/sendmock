# 06. HTTP API

Base path: `/api/v1`. JSON in and out. The OpenAPI 3.1 document is served at `/api/openapi.json` and drives both the UI's TypeScript types and the user-facing API docs page.

Auth: none by default; when `--ui-auth` is set, the same basic auth (or an API token from settings) protects the API.

CORS: `--cors-origins` (default: the official docs site origin, so the website's API playground can reach a local instance after the user clicks Connect; set to empty to disable). See [16-website-and-releases.md](16-website-and-releases.md#api-playground).

## Email

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/emails` | list, cursor pagination (`?cursor=&limit=`), filters (`q`, `from`, `to`, `unread`, `tag`) |
| GET | `/emails/{emailId}` | parsed message (headers, text, html, attachments meta, extracted data) |
| GET | `/emails/{emailId}/raw` | original `.eml` |
| GET | `/emails/{emailId}/html` | sanitised HTML for preview iframe |
| GET | `/emails/{emailId}/attachments/{index}` | download attachment |
| PATCH | `/emails/{emailId}` | mark read/unread, set tags |
| POST | `/emails/{emailId}/open` | record an open and fire `email.opened`; body `{ "source": "ui" \| "manual" \| "api" }` (default `api`) |
| GET | `/emails/{emailId}/opens` | open history |
| DELETE | `/emails/{emailId}` | delete one |
| DELETE | `/emails` | delete all (or by filter) |
| GET | `/emails/latest` | newest message, optionally filtered by `to` |
| POST | `/send` | native HTTP send (JSON, with base64 `attachments`, see [03-email.md](03-email.md#native-send-attachments)); provider-compatible send APIs live under `/providers/*` and the provider port ([03-email.md](03-email.md#http-send-apis)) |
| POST | `/emails/{emailId}/simulate` | simulate `delivered`, `deferred`, `bounced` (hard/soft), `complained`, `unsubscribed` |
| GET | `/emails/{emailId}/timeline` | received, opened, delivery outcomes, releases, webhooks |
| GET | `/emails/{emailId}/mime` | MIME tree |
| GET | `/emails/{emailId}/parts/{partId}/thumbnail` | image thumbnail |
| GET | `/emails/{emailId}/html-check` | HTML/CSS client compatibility report |
| POST | `/emails/{emailId}/link-check` | check links and images (outbound requests) |
| POST | `/emails/{emailId}/spam-check` | SpamAssassin score (when configured) |
| GET | `/emails/{emailId}/list-unsubscribe` | List-Unsubscribe header validation |
| POST | `/emails/{emailId}/release` | send to a real SMTP relay (`{ "to": [...] }` optional) |
| GET/POST/PATCH/DELETE | `/tag-rules`, `/forward-rules` | automatic tagging and auto-forward rules |
| GET/POST/PATCH/DELETE | `/outcome-rules/email` | custom outcome addresses; `POST /outcome-rules/email/{ruleId}/move` with `up` or `down` reorders |

## SMS

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/sms` | native send, with optional `media_urls` and inline base64 `media` (see [04-sms.md](04-sms.md#mms-and-media)) |
| GET | `/sms` | list, filters (`to`, `from`, `status`, `direction`, `q`) |
| GET | `/sms/{smsId}` | one message with status history |
| GET | `/sms/{smsId}/media/{mediaIndex}` | one stored media file (MMS or WhatsApp), with its content type |
| GET | `/sms/threads` | conversations grouped by number pair |
| POST | `/sms/{smsId}/status` | manually set status (manual profile) |
| POST | `/sms/{smsId}/open` | record a simulated read and fire `sms.opened` (outbound only, 409 for inbound) |
| GET | `/sms/{smsId}/opens` | open history |
| POST | `/sms/inbound` | simulate incoming SMS |
| DELETE | `/sms/{smsId}`, `/sms` | delete one / all |
| GET/POST/PATCH/DELETE | `/numbers` | virtual number registry |
| GET/POST/PATCH/DELETE | `/outcome-rules/sms` | custom outcome numbers; `POST /outcome-rules/sms/{ruleId}/move` with `up` or `down` reorders |
| GET/POST/PATCH/DELETE | `/messaging-services` | Twilio-style Messaging Services (sender pools) |

## Verify

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST/PATCH/DELETE | `/verify/services` | Verify services (code length, fixed code, TTL) |
| GET | `/verify` | verifications list (filters `to`, `status`, `channel`) |
| GET | `/verify/{verificationId}` | one verification with code, attempts, timeline |
| POST | `/verify/{verificationId}/force` | force `approved`, `canceled`, `expired`, `max_attempts` |

The Twilio Verify wire API itself (`/v2/Services/...`) is served on the provider port ([04-sms.md](04-sms.md#twilio-verify)).

## HTTP catcher

| Method | Path | Purpose |
|--------|------|---------|
| ANY | `/catch/{bin}/*` | capture any request (outside `/api/v1`, see [15-http-catcher.md](15-http-catcher.md)) |
| GET/POST/PATCH/DELETE | `/http/bins` | bins, presets and mock response rules |
| GET | `/http/requests`, `/http/requests/{requestId}` | captured requests |
| POST | `/http/requests/{requestId}/forward` | resend a captured request to a URL |

## Payments

Native payments, hosted checkout, simulate actions, resend IPN, test cards and `wait/payment`; provider wire APIs (Stripe, PayPal, SSLCommerz, ...) are on the provider port. Full table in [17-payments.md](17-payments.md#api-sendmock-native).

## Logs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/logs/smtp`, `/logs/smtp/{sessionId}` | SMTP sessions with full transcripts (incl. failed sessions) |
| GET | `/logs/http`, `/logs/http/{requestId}` | requests to native and provider APIs, including rejected ones |

## Webhooks

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST/PATCH/DELETE | `/webhooks/endpoints` | manage endpoints; the list adds `delivery_count_24h` and `success_history` (24 hourly success rates, `null` for hours without deliveries) |
| POST | `/webhooks/endpoints/{endpointId}/test` | send `test.ping` |
| POST | `/webhooks/endpoints/{endpointId}/send` | manual send (email_id, sms_id, or raw payload) |
| GET/POST/PATCH/DELETE | `/webhooks/rules` | manage rules |
| POST | `/webhooks/rules/preview` | which of the last 50 messages a filter would match: body `{ "events": [...], "filter": {...} }`, returns `checked_count`, `match_count` and the messages with `is_match` |
| POST | `/webhooks/rules/{ruleId}/move` | reorder: `{ "direction": "up" }` or `"down"` |
| GET | `/webhooks/deliveries` | delivery log with filters |
| GET | `/webhooks/deliveries/{deliveryId}` | full request/response |
| POST | `/webhooks/deliveries/{deliveryId}/replay` | resend (optionally with edited body) |
| POST | `/webhooks/deliveries/{deliveryId}/cancel` | stop pending retries |
| GET/POST/PATCH/DELETE | `/webhooks/variables` | global and endpoint variables |
| POST | `/webhooks/variables/{variableId}/regenerate` | refresh a Fixed random variable |
| POST | `/webhooks/render` | render templates against a sample without sending |
| GET | `/webhooks/template-reference` | functions, filters and context fields for autocomplete |
| GET/POST/PATCH/DELETE | `/webhooks/templates` | built-in and custom payload templates, plus `render`, `revisions`, `export`, `import` (see [13-webhook-templates.md](13-webhook-templates.md)) |
| GET/POST/DELETE | `/webhooks/saved` | saved deliveries (bookmarks); `POST /webhooks/saved/{savedId}/send` |
| POST | `/webhooks/endpoints/{endpointId}/rotate-secret` | rotate the Standard Webhooks secret with an overlap window (`{ "overlap_hours": 24 }`); the response carries the new masked secret and `previous_secret_expires_at` |
| GET | `/webhooks/endpoints/{endpointId}/secret` | reveal the plain secret (the reveal is written to the API request log); everywhere else secrets are masked |

Manual send and replay accept `"variables": { ... }` overrides and `"rerender": true|false`. Details in [12-webhook-variables.md](12-webhook-variables.md).

## Test-automation helpers

These make SendMock useful from any test framework without polling loops:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/wait/email?to=user@x.test&subject=Verify&timeout=10s` | long-poll until a matching email arrives (or 408) |
| GET | `/wait/sms?to=%2B8801700000000&timeout=10s` | same for SMS |
| GET | `/wait/http?bin=slack&timeout=10s` | same for HTTP catcher requests |
| GET | `/wait/webhook?endpoint=...&status=succeeded&timeout=10s` | wait for a webhook delivery outcome |
| GET | `/otp?to=...&channel=sms\|email\|verify` | latest OTP for a recipient (extracted from messages or from Twilio Verify) |
| GET | `/links?to=...` | latest extracted links for a recipient |
| POST | `/samples/{kind}` | create a sample through the normal path: `email` (sent over SMTP to SendMock itself, so an SMTP session is logged), `sms` (native send), `verification` (started on the first Verify service, or a new "Sample" service); returns `{ "kind": ..., "id": ... }`. CLI `sendmock sample <kind>`, MCP `create_sample` |
| POST | `/reset` | wipe traffic and restore the seed state (between test runs) |
| POST | `/seed/apply`, GET `/seed/export` | apply or export the seed file ([02-architecture.md](02-architecture.md#configuration-and-seed-file)) |
| POST | `/seed/validate` | check a seed file without applying it: errors with line numbers and a summary of what would change |
| GET | `/seed/status` | seed file path, when it was applied, and items added or changed since |
| GET | `/stats` | totals and today's counts, 24 hourly activity buckets (emails, SMS, HTTP requests, deliveries), per-endpoint webhook metrics (deliveries, success rate, p50 / p95 latency, retries, top failure codes) and recent failed deliveries |

`wait` endpoints only match messages received after an optional `since` timestamp (defaults to "now minus 30 s") to avoid matching stale messages.

## Settings and system

| Method | Path | Purpose |
|--------|------|---------|
| GET/PATCH | `/settings` | retention, email and SMS options, opened events, chaos toggles, OTP patterns; `PATCH` takes only the changed keys and returns field-level errors for invalid values |
| GET | `/info` | version, uptime, listeners, counts, DB size, and `is_container` (true when SendMock runs in Docker, so the UI can default to container hostnames) |
| GET | `/updates` | opt-in update check against GitHub Releases for the running channel; `409` while the update check is off |
| GET | `/health` | liveness for Docker/CI (also `sendmock health` CLI for the Docker HEALTHCHECK) |

## Realtime

`GET /api/v1/ws` (WebSocket). Server pushes event envelopes identical to the native webhook format (`{ id, type, created_at, data }`, with `data` trimmed to list-view fields). The UI uses it to update lists, counters and the delivery log live. A Server-Sent Events fallback at `/api/v1/events` is cheap to add and handy for `curl`.

## Conventions

- Errors: `{ "error": { "code": "not_found", "message": "..." } }` with proper HTTP status.
- Times: RFC 3339 UTC strings in JSON.
- Pagination: opaque `next_cursor` (ULID based).
- Versioning: breaking changes go to `/api/v2`; `v1` stays stable once 1.0 ships.
- Mailpit-compatible aliases (`/api/v1/messages`, `/api/v1/message/{ID}`) are a stretch goal to ease migration of existing test suites.
