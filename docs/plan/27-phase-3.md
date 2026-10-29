# 27. Phase 3: Webhooks backend

Phase 3 makes webhooks real: endpoints and rules subscribe to SendMock's events, a persistent queue delivers them signed with Standard Webhooks and retries with backoff, payloads are rendered from templates and variables with `minijinja`, and every delivery can be sent by hand, replayed, edited and saved. It also brings the email delivery outcomes and opened events, the Twilio-style SMS reply webhook, the full seed file, and switches the Webhook screens and the Overview to live data ([11](11-roadmap.md#phase-3-webhooks-backend-about-2-3-weeks)).

## Goal and done-when

**Done when** (from [11](11-roadmap.md#phase-3-webhooks-backend-about-2-3-weeks)): a rule forwards every `*@inbound.local` email to a local Express handler, the delivery log shows the request and response, and a failed delivery retries, then succeeds after the handler is fixed and the delivery replayed. In full:

- every Phase 3 item in [PROGRESS.md](PROGRESS.md) is ticked and the criteria below have passing tests that name them;
- the Express done-when check runs in CI against a release binary;
- the live UI suite shows Webhooks (overview, endpoints, rules, deliveries, composer, templates, variables, saved) and the Overview with real data and no failing calls.

## Workstreams and order

All on `feat/phase-0` in #48, a commit per workstream, as the owner asked on 2026-10-29.

| # | Workstream | Criteria | Depends on |
|---|------------|----------|------------|
| W1 | Endpoints and signing: migration (`webhook_endpoints`, secrets), `WebhookEndpointRepository`, endpoint CRUD, `WebhookSecret` value object (`whsec_`), Standard Webhooks signing and secret rotation with overlap | WH-01, WH-04 | |
| W2 | Delivery engine: `webhook_deliveries` table as the persistent queue, `WebhookDispatchService` with a retry Strategy (5 attempts, 1s, 5s, 30s, 2m, 10m; retry on 5xx, timeouts and connection errors), a `WebhookSender` trait the binary implements with reqwest, cancel, deliveries list and detail, `wait/webhook`, queue survives a restart | WH-03, PL-03 (webhook part) | W1 |
| W3 | Rules and events: rules with filters subscribed to the event bus (Observer), event to endpoint fan-out, rule CRUD, order and enable | WH-02 | W2 |
| W4 | Templating: the shared template engine moves onto `minijinja` (provider definitions keep passing their tests unchanged), variables CRUD and scopes, built-in context, text filters, random functions, Fields and Raw body modes, strict and lenient rendering, `/webhooks/render` | WH-07 (Phase 3 part) | W1 |
| W5 | Payload templates: built-in native, Twilio, Vonage, Slack and Discord templates from the exported definitions, custom templates (create, clone, save from endpoint, linked and detached), the endpoint payload preview, the template reference | WH-08 (Phase 3 part), WH-09 (Phase 3 part) | W4 |
| W6 | Manual send, the endpoint test send, replay and edit-and-replay; saved deliveries; `/webhooks/metrics` and `/stats` | WH-05, WH-10, WH-11 | W2, W5 |
| W7 | Email outcomes and opened events: magic addresses (with the SES mailbox simulator), the delivery profile, `/emails/{emailId}/simulate`, custom outcome addresses (`/outcome-rules/email` with its test), `email.delivered`, `deferred`, `bounced`, `complained`, `unsubscribed`; `/open` for email and SMS with open history, auto-fire and first-open settings | EM-10 (native events), EM-11, SM-10 | W3 |
| W8 | Provider formats and the SMS reply webhook: Twilio and Vonage inbound and status formats with signatures; the reply webhook (number and Messaging Service inbound URLs, fallback, TwiML replies in the thread, Twilio error codes, at most 10 fetches, resend); status callbacks move onto the persistent queue with retries | WH-06 (Twilio, Vonage), SM-09.2 to SM-09.7, SM-08.3 | W2, W5 |
| W9 | Seed file: every configuration kind (endpoints, rules, templates, variables, numbers, Messaging Services, Verify services, outcome rules, providers) applied and exported, secrets as `${ENV}`, `reset` restores the seed, `seed status` | PL-04 (Phase 3 part), SM-03.3, SM-07.7, SM-16.7 (live) | W1 to W8 |
| W10 | Surfaces and screens: CLI `webhook` (send, tail, endpoints, rules, templates, variables, deliveries) and `outcome-rule email`; MCP `webhooks`, `templates`, `variables` and `rules` toolsets; Webhook screens and the Overview live; live UI suite extended | AI-01, AI-02 (new tools), UI-12.2 | W1 to W9 |
| W11 | Done-when: an Express handler in `examples/webhooks/` receives an inbound-email rule's deliveries in CI, fails first, then succeeds after a replay | Phase 3 done-when | W10 |

## As built

Notes are added here as each workstream lands.

- **W1 (endpoints and signing):** migration `0010` adds `webhook_endpoints`; `WebhookEndpointRepository` keeps the name, URL, enabled state, the request settings as one JSON document owned by the operations layer, the signing secret, and the previous secret with its expiry. Operations in `sendmock-ops/src/webhooks/`: list, create, show, update (only the sent keys, then the whole endpoint is checked again), delete, reveal secret (CLI with `--reveal`, no MCP tool) and rotate secret (overlap of 1, 24 or 168 hours, as the Security tab offers). Validation matches the edit sheet's rules (`web/src/lib/webhooks/validate-webhook-endpoint.ts`): a name, an http(s) URL or a templated one, a valid Fields or Raw body, timeout 1 to 60 s, 1 to 10 attempts, retry delays 1 s to 24 h. The view masks the secret (`whsec_••••` and the last four characters) and shows `previous_secret_expires_at` only while the old secret still signs; `success_rate`, `delivery_count_24h` and `success_history` stay empty until W2 records deliveries. In `sendmock-webhooks`: the `WebhookSecret` value object (`whsec_` and base64, generated from the `RandomSource`, masked `Debug`) and Standard Webhooks signing (`sign_payload`, `build_signed_headers` with space-separated signatures during an overlap), checked against the spec's published example. WH-01.1, WH-01.3, WH-01.5 and WH-01.8 are proven at the API; they are ticked when the CLI, MCP, seed and live screens land (W9, W10). WH-04 is ticked when deliveries carry the headers (W2) and the official libraries verify them (W11). Test send and the request preview moved to W6 and W5.

## Design notes

- **Crates:** the domain lives in `sendmock-webhooks` (layer 2): `endpoint`, `signing` (Standard Webhooks, `WebhookSecret`), `retry_policy` (Strategy), `rule_filter` (filter operators as Strategies), `delivery_plan`, `payload` (Builder for requests). Storage is `WebhookEndpointRepository`, `WebhookRuleRepository`, `WebhookDeliveryRepository`, `WebhookTemplateRepository` and `WebhookVariableRepository` in `sendmock-store`; operations in `sendmock-ops/src/webhooks/`.
- **Queue:** a delivery row is the queue entry (`status`, `attempt`, `next_attempt_at`). One dispatcher task in the binary claims due rows, sends them through the `WebhookSender` trait, records the attempt and schedules the next from the retry policy; on start it picks up rows left `queued` or `retrying`, so a restart loses nothing. Tests drive the policy with the `Clock` trait and a recording sender.
- **Events:** rules subscribe to the existing event bus; the dispatcher never reads email or SMS tables, it renders from the event payload, so webhooks stay a subscriber like WebSocket and SSE.
- **One template engine:** [22](22-configurable-providers.md) asks provider definitions and webhooks to share one engine. Phase 2 built a small engine in `sendmock-core` for provider definitions; W4 replaces its internals with a `minijinja` environment carrying SendMock's filters (`json`, `urlencode`, `lower`, `upper`, ...) and functions (`uuid`, `random_hex`, `now_iso`, ...), behind the same function signatures, so the provider runtime is untouched and its fixture tests are the regression check. JSON-context escaping stays as built in Phase 2.
- **Status callbacks** of Phase 2 move onto the persistent queue in W8 and gain retries like webhooks (SM-08.3), keeping the provider's format and signature.
- **Outcome rules for email** reuse the SMS outcome rule design (`/outcome-rules/sms` in Phase 2): pattern rules evaluated before magic addresses, then the profile.

## New dependencies

| Crate | Used by | Why |
|-------|---------|-----|
| `minijinja` | W4 | Jinja2-syntax templating for webhook payloads and provider definitions, sandboxed (no file, network or env access); already chosen in [12](12-webhook-variables.md) |
| `sha2` | W1 | HMAC-SHA256 for Standard Webhooks signatures (with `hmac` and `base64`, already direct dependencies); 0.11 is already in the tree through other crates, so it becomes a direct dependency without a new download |
