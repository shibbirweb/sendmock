# 24. Stage B coverage: every UI feature has a backend phase

The UI signed off at the end of Stage A calls 221 operations (the surface catalogue in `web/src/lib/api/surface-catalogue/`, one entry per REST operation with its CLI command, MCP tool and UI place). This document maps each of them to the Stage B phase that builds its backend, so nothing the UI offers is left without a plan. It was written from an audit on 2026-10-29, before Phase 0 started.

When an operation is added to the catalogue, it gets a row here (or joins an existing group) and a phase. From Phase 1 the catalogue also carries the phase per operation, and UI-12.1 fails on an operation without one ([07](07-ui.md#not-available-yet-stage-b)).

## Map

| Area | Operations | Phase | Screen goes live |
|------|-----------|-------|------------------|
| **System** | `health`, `info` | 0 | |
| | `seed/validate` | 0 | |
| | `settings` (get, patch), `reset`, `updates`, `logs/smtp` (2), `logs/http` (2) | 1 (settings sections grow with each phase; `reset` restores the seed from 3) | Logs and Settings in 1 |
| | `samples/{kind}` | `email` 1, `sms` and `verification` 2, `number` 2, `http` 4 | |
| | `seed/status`, `seed/export`, `seed/apply` | 3 | |
| | `stats` | 3 | Overview in 3 |
| **Test helpers** | `wait/email`, `otp`, `links`, `events/recent`, `integrations/{stack}` | 1 | |
| | `wait/sms` | 2 | |
| | `wait/webhook` | 3 | |
| | `wait/payment` | 3P | |
| | `wait/http` | 4 | |
| | `scenarios` (validate, run), `ai/agents`, `ai/skill` | 4 | Scenarios in 4 |
| **Mail** | list, delete all, `latest`, get, patch, delete, `timeline`, `mime`, `raw`, attachments, thumbnails, `list-unsubscribe`, `send`, `send/raw` | 1 | Mail in 1 |
| | `open`, `simulate` | 3 | |
| | `html-check`, `link-check`, `spam-check`, `release`, `reply`, `forward`, `emails/inbound` | 4 | |
| | inbound routes (5) | 4 | Webhooks > Inbound routes in 4 |
| **Message rules** | SMS outcome rules (6) | 2 | Settings > SMS section in 2 |
| | email outcome rules (6) | 3 | Settings > Email outcome addresses in 3 |
| | tag rules (5), auto-forward rules (5) | 4 | Settings > Email rule cards in 4 |
| **Providers** | SMS providers (9) | 2 for the built-ins (Twilio, Twilio Verify, Vonage), 4 for custom providers | SMS > Providers in 2 |
| | email providers (9) | 4 | Mail > Providers in 4 |
| **SMS** | list, delete all, send, `threads`, get, delete, media, `status`, `sms/inbound` | 2 | SMS in 2 |
| | `open`, `reply-webhook/resend` | 3 | |
| **Verify** | verifications (3), services (4) | 2 | Verify in 2 |
| **Numbers** | numbers (4), Messaging Services (4) | 2 (moved from 4) | Numbers in 2 |
| **HTTP catcher** | bins (4), responses (3), requests (5), `/catch/{binPath}` (5) | 4 | HTTP Catcher in 4 |
| **Webhooks** | endpoints (11), rules (7), deliveries (4), `metrics`, saved deliveries (6) | 3 | Webhooks in 3 |
| | templates (13), variables (6) | 3; import, export, revisions, fake data and the remaining built-ins in 4 | |
| **Payments** | payments, checkout, test cards (8), gateways (8), methods (6), flows (11) | 3P | Payments and the test checkout in 3P |

Payment subscriptions and disputes (Phase 4) have no UI operation yet; they join the catalogue with their phase when they are planned in detail.

## Features with no backend to build

These live in the browser and are done: theme, command palette, keyboard shortcuts, notification settings and toast position, the Help menu and community links, the per-screen guide links, and the demo toolbar (mock build only).

## What the audit changed (2026-10-29)

Gaps, all fixed in [11](11-roadmap.md) and [PROGRESS.md](PROGRESS.md):

- **No phase at all:** `POST /send/raw` and `GET /emails/latest`, `GET /events/recent` and the SSE stream, `POST /samples/{kind}`, `GET /integrations/{stack}`, the Settings API, UI and API auth (PL-06.2), and the screens Logs, Settings, Overview, HTTP Catcher, Numbers and Scenarios, which had no "switched to live mode" step. The CLI and MCP `logs`, `admin`, `rules`, `numbers` and `http` toolsets had no phase either.
- **In the acceptance files or plan docs but missing from the roadmap:** the configurable provider runtime (SM-16 in Phase 2, EM-18 in Phase 4, from [22](22-configurable-providers.md#13-stage-b)), gateway, method and flow configuration (PY-12, Phase 3P), `wait/sms` (Phase 2) and `wait/webhook` (Phase 3) from PL-03, MMS media and custom outcome numbers (Phase 2) and custom outcome addresses (Phase 3), the real update check (Phase 1, from [16](16-website-and-releases.md#update-checker-extended-2026-10-27-owner-feedback-f15)), and the MCP `verify` toolset.
- **In the roadmap but missing from PROGRESS:** the Phase 3P capture, refunds, events, templates, `wait/payment`, CLI, MCP and live screens, and the Phase 4 payment items (bKash, Razorpay, Paddle, subscriptions, disputes).
- **Out of order:** virtual numbers were in Phase 4, but Phase 2 Messaging Services use number pools and the Phase 3 reply webhook reads a number's inbound URL.
- **No mechanism:** the roadmap switched screens to live one area at a time, but the UI switches the whole app between mock and live, and some Mail buttons only get a backend in Phase 3 or 4.

Decisions by the owner on 2026-10-29:

- From Phase 1 the binary embeds the live UI build only; operations it does not serve yet show **Not available yet** with their phase ([07](07-ui.md#not-available-yet-stage-b), new feature UI-12 with three criteria, and `available_operations` in `GET /info`, [06](06-api.md#settings-and-system)).
- Virtual numbers and Messaging Services move to Phase 2 (SM-12).
- UI and API auth lands in Phase 1, with the first beta.
