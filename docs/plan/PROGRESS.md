# Progress Tracker

Where the project stands, what is done, and what is left. The plan itself is in [README.md](README.md) and the phase details in [11-roadmap.md](11-roadmap.md); this file only tracks status.

**Last updated:** 2026-10-25

## Current position

| | |
|---|---|
| **Stage** | Stage A: UI with mock data |
| **Current phase** | **Phase U2: webhook endpoints, rules, deliveries, saved deliveries, templates, suggestions and variables built on mock data**; the request editor next (U1: 18 / 18) (U0: 14 / 15, required CI checks still to add) |
| **Latest release** | none yet (first beta `0.1.0-beta.1` is planned for Phase 1) |
| **Blockers** | none |
| **Live preview** | https://shibbirweb.github.io/sendmock/ (demo at `/demo/`), published from `develop` |
| **Feature acceptance** | 0 / 96 accepted, 10 / 402 criteria ticked; the U1 screen features are in progress with their UI criteria tested on mock data ([acceptance/](acceptance/README.md)) |

**Next up:**

1. Add the required status checks (Web UI, Acceptance traceability, Website) to the `develop` and `main` rulesets.
2. Continue Phase U2: request editor (CodeMirror, body modes, live preview, inline errors).

## How to update this file

- Feature completeness is tracked separately in [acceptance/](acceptance/README.md): a phase is only `Done` when the features it delivers are `Accepted` (or `UI done` for Stage A phases).
- An item is only ticked when its tests are merged and green in GitHub Actions (see Testing in [AGENTS.md](../../AGENTS.md#testing)).
- Tick an item when its pull request is **merged into `develop`**, and add the PR number: `- [x] App shell (#12)`.
- Change a phase's status in the overview table when it starts or finishes, and move "Current position" along.
- Add a line to the [Update log](#update-log) for anything notable (phase done, scope change, release).
- Status values: `Done`, `In progress`, `Not started`, `Blocked`, `Dropped`.
- Scope changes go into the relevant plan doc first, then here.

## Overview

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| P | Planning | In progress | 12 / 13 |
| U0 | UI foundations | In progress | 14 / 15 |
| U1 | Mail, SMS, Verify, Numbers, Logs, Settings screens | In progress | 18 / 18 |
| U2 | Webhook, HTTP catcher and payment screens | In progress | 8 / 14 |
| U3 | Polish, website, contract freeze, **sign-off gate** | Not started | 0 / 11 |
| 0 | Backend foundations | Not started | 0 / 14 |
| 1 | Email backend + first beta | Not started | 0 / 15 |
| 2 | SMS and Verify backend | Not started | 0 / 12 |
| 3 | Webhooks backend | Not started | 0 / 15 |
| 3P | Payment gateway backend | Not started | 0 / 6 |
| 4 | Integrations, fidelity and AI | Not started | 0 / 18 |
| 5 | Distribution and 1.0 stable | Not started | 0 / 13 |

---

## Phase P: Planning

- [x] Vision, scope, non-goals ([01](01-vision.md))
- [x] Architecture, tech stack, data model ([02](02-architecture.md))
- [x] Email, SMS, webhooks, API, UI, integrations, distribution plans ([03](03-email.md) to [09](09-distribution.md))
- [x] Webhook variables, templates, AI integration, HTTP catcher ([12](12-webhook-variables.md) to [15](15-http-catcher.md))
- [x] Competitor research and gap analysis (Mailpit, Mailtrap, smtp4dev, Twilio test mode, emulate, MockPost, Standard Webhooks, Hookdeck, Webhook.site) folded into the plan
- [x] UI-first roadmap with mock data ([11](11-roadmap.md))
- [x] Docker as a first-class channel ([09](09-distribution.md#docker))
- [x] Website, API playground and beta/stable release model ([16](16-website-and-releases.md))
- [x] Plan moved to `docs/plan/`, progress tracker added
- [x] `AGENTS.md` with the common rules, imported by `CLAUDE.md`
- [x] Acceptance criteria for every feature (81 features, 289 criteria) in [acceptance/](acceptance/README.md)
- [x] Plan committed to the repository on `develop`
- [ ] Placeholder decisions confirmed or deferred (name, ports, licence)

## Stage A: UI with mock data

### Phase U0: UI foundations

- [x] `develop` and `main` branches, branch protection, PRs target `develop` (rulesets on both: pull request required, no force push, no deletion; default branch `develop`) (#1)
- [x] `web/` scaffold: Bun, Vite, React 19, TypeScript, Tailwind v4, shadcn/ui (044db8b)
- [x] TanStack Router and Query, lucide, sonner (044db8b)
- [x] App shell: sidebar, three-pane layout, responsive collapse (044db8b; the three-pane list/detail layout arrives with the U1 screens)
- [x] Theme: dark / light / system (044db8b)
- [x] Command palette and keyboard shortcut system with `?` help (044db8b)
- [x] MSW setup (HTTP + WebSocket) and in-memory mock DB (f8209c5)
- [x] Fixture generators (emails, SMS, Verify, catcher, logs, webhooks, templates, variables) (f8209c5)
- [x] Dev toolbar (latency, errors, empty, large data, realtime on/off) (f8209c5)
- [x] API types (`web/src/lib/api/types/`) and query hooks for all resources (f8209c5)
- [x] Lint (incl. `max-lines` 500 and `max-lines-per-function` limits from `AGENTS.md`), typecheck, Vitest, Playwright smoke test; `ci.yml` for `web/` and `website/` (f7dca57, 4f8d212, 3ae88c2; first GitHub run passed on #1)
- [x] Website skeleton in `website/` (Fumadocs + shadcn + Magic UI, Magic UI MCP in `.mcp.json`) (3ae88c2)
- [x] `website.yml` deploys GitHub Pages with the mock UI at `/demo/` (shareable preview URL): https://shibbirweb.github.io/sendmock/ (#1)
- [ ] Test setup: Vitest + React Testing Library + Playwright in CI, coverage report on PRs, required checks on `develop` and `main` (set up and passing in CI with an 80% gate on `src/lib`; still open: add Web UI, Acceptance traceability and Website as required checks in the rulesets)
- [x] `scripts/acceptance.ts` traceability check (criterion IDs in tests vs `docs/plan/acceptance/`) running in CI (4f8d212)

### Phase U1: Mail, SMS, Verify, Numbers, Logs, Settings screens

- [x] Overview dashboard
- [x] Mail list, search and filter chips, source and outcome badges (virtual rows, infinite loading, J/K/D and / shortcuts)
- [x] Mail detail: HTML (devices, images toggle, screenshot), Text, Source, Headers
- [x] Mail detail: Attachments with thumbnails, MIME tree, Checks, Timeline, Template data
- [x] Mail actions: read/unread, simulate open, simulate delivered/bounce/complaint/unsubscribe, download, release, delete, bulk delete (tag editing and "send to webhook" follow with the webhook screens in U2)
- [x] Extracted OTP/links panel, opened indicator, browser notifications (open history list follows with Logs)
- [x] Mail reply, reply all and forward as recipient: inline composer with the original in the body (Gmail style), Inbound badge, links between originals and replies, `is:inbound` search, R / Shift+R / F ([07](07-ui.md#mail), EM-17)
- [x] SMS threads and conversation view (SMS and WhatsApp styling, status ticks, badges; search and channel chips, J/K and / shortcuts)
- [x] SMS message drawer, inbound composer, manual status, simulate read (drawer: status timeline, request JSON with request log link, callback attempts; manual Delivered / Undelivered / Failed with error code picker)
- [x] SMS and WhatsApp media (MMS): thumbnails and file chips, drawer media list, attach in "Reply as recipient", Connection chips ([04](04-sms.md#mms-and-media), SM-15)
- [x] Verify tab: verifications, timeline, force-state buttons, Verify services editor (live expiry countdown, status chips, link to the SMS with the code)
- [x] Numbers registry and Messaging Services tab (inbound URL, method, fallback, format and status callback per number; sender pools with inbound handling)
- [x] Logs: SMTP sessions and transcript viewer (failed sessions highlighted, colour-coded transcript, email to session links, 50 rows per page)
- [x] Logs: HTTP API request log with rejected requests (filters by status class, API and path, formatted bodies, message links, 50 rows per page)
- [x] Settings: retention, reset to seed, seed export/apply, email and SMS options, opened events, chaos, OTP patterns (per-section save with field errors; tag and forward rules follow with the U2 rule builder)
- [x] Settings: connection snippets per language (incl. Docker hostnames), about and update channel
- [x] Custom outcome numbers and addresses with the Magic numbers and Magic addresses switches and "Test a number / address" boxes ([04](04-sms.md#custom-outcome-numbers), [03](03-email.md#delivery-outcome-simulation), SM-07.7 to SM-07.9, EM-10.5, EM-10.6)
- [x] Empty states with "how to connect" and "send sample" (no data told apart from no match, shared "Where does your app run?" choice, `POST /samples/{kind}`)

### Phase U2: Webhook, HTTP catcher and payment screens

- [x] Endpoints table and edit sheet (`whsec_` secret and rotation, retry policy, template picker, overrides, endpoint variables; Send test dialog, 24-hour success sparkline, Docker hint)
- [x] Rules list and visual rule builder with match preview (firing order, endpoint filter, all / any groups with not, field-aware values, live preview of the last 50 messages)
- [x] Deliveries live log and detail (cURL, replay, re-render, edit and replay, cancel, `render_failed`; paged with status, endpoint and event filters, every attempt of an event, Save)
- [x] Saved deliveries (bookmarks): searchable list with the stored request, send to any endpoint with optional re-render, rename, delete, save as template; kept through reset and written to the seed export
- [x] Templates gallery and detail (category tabs, search and event filter in the URL; request shape, doc link and live preview; Edit for built-in and custom templates with Reset to default; Use in new endpoint, Clone, Export, Delete with detach)
- [x] Template editor (clone, save from endpoint, import/export, revisions with diff; New template, custom template details, Import with Replace or copy, History with Compare and Restore)
- [x] Template reference panel and `{{` suggestions in the template editor ([12](12-webhook-variables.md#template-reference-and-suggestions), WH-07.9, WH-07.10)
- [x] Variables (all kinds, masked secrets, regenerate; scope, kind and name filters, Resolves to preview, suggestions for expressions)
- [ ] Request editor: CodeMirror, `{{` autocomplete, body modes, live nunjucks preview, inline errors
- [ ] Manual send dialog and composer (Prompt variables, overrides)
- [ ] HTTP catcher: bins, requests, Slack/Discord/push previews, response rules, forward
- [ ] Webhooks overview metrics
- [ ] Payments list, detail and Simulate menu; hosted test checkout page with provider themes; Settings > Payments
- [ ] Replies: Inbound routes list and editor, SMS reply webhook result and drawer tab, inbound URL and fallback on Numbers

### Phase U3: Polish, website, contract freeze, sign-off gate

- [ ] Design review pass on every screen (hierarchy, spacing, microcopy, empty/loading/error states)
- [ ] Accessibility pass (keyboard-only, focus, contrast, labels, reduced motion)
- [ ] Performance with large data (virtualised lists, bundle under 250 KB gzipped, lazy editors)
- [ ] Responsive check (split screen, tablet, phone)
- [ ] Notification settings: pop-up toasts or bell only, header bell with unread count and a notification list ([07](07-ui.md#notifications), UI-08)
- [ ] Feedback round on the preview URL, iterations done
- [ ] Website landing page with Magic UI (animated beam, terminal, marquee, bento grid, number ticker)
- [ ] Website docs structure drafted (`docs/wiki/`)
- [ ] API reference and playground in Demo mode
- [ ] OpenAPI contract frozen at `docs/api/openapi.yaml`
- [ ] **Sign-off: UI approved, Stage B may start**

## Stage B: Backend

### Phase 0: Backend foundations

- [ ] Cargo workspace and crate skeletons
- [ ] `rust-embed` UI embedding, SPA fallback, dev proxy
- [ ] Config (clap, env, `sendmock.toml`), tracing, graceful shutdown
- [ ] SQLite, migrations, WAL mode
- [ ] `sendmock-ops` registry, CLI skeleton (`sendmock status --json`, exit codes), parity CI check
- [ ] Seed loader skeleton (`seed validate`)
- [ ] OpenAPI contract tests against handlers
- [ ] Rust CI on Linux, macOS, Windows (incl. Clippy `too_many_lines` and a 500-line file check)
- [ ] Rust test setup: nextest, `insta` snapshots, `cargo llvm-cov` coverage gate (80% overall, 90% domain/operations), test fakes for `Clock`, `IdGenerator`, random source
- [ ] `scripts/version.ts`, `CHANGELOG.md`
- [ ] Release workflows: `beta.yml`, `beta-publish.yml`, `stable.yml`, `stable-promote.yml`, `stable-publish.yml`, `release.yml`
- [ ] Dockerfile and `docker-edge.yml` (`edge` image from `develop`)
- [ ] Versioned website builds (`/next/` from `develop`)
- [ ] Repo `README.md`, licence, `CONTRIBUTING.md`

### Phase 1: Email backend and first beta

- [ ] SMTP server (EHLO, MAIL, RCPT, DATA, PIPELINING, SIZE, 8BITMIME, SMTPUTF8, AUTH, STARTTLS)
- [ ] MIME parsing, storage, retention, FTS search
- [ ] OTP and link extractors
- [ ] Email REST API and WebSocket events
- [ ] `sendmail` shim
- [ ] Native HTTP send API (`POST /api/v1/send`)
- [ ] SMTP session log and HTTP API request log
- [ ] Plus-address tagging, MIME tree, thumbnails, List-Unsubscribe check
- [ ] `wait/email`, `otp`, `links`, `reset`; `--ready-json`
- [ ] CLI `email` / `otp` / `links`; MCP `core`, `email`, `extract` toolsets
- [ ] Mail screens switched to live mode
- [ ] SMTP compatibility tests with real clients
- [ ] CORS for the docs origin; playground Local mode
- [ ] Done-when check: Laravel and Node mail appear live; pytest reads an OTP
- [ ] **Release `0.1.0-beta.1`** (GitHub pre-release, Docker `beta`, Homebrew `sendmock-beta`)

### Phase 2: SMS and Verify backend

- [ ] Native SMS API (JSON, form, GET)
- [ ] Twilio Messages API and Messaging Services
- [ ] MMS media: Twilio `MediaUrl`, native `media_urls` and inline `media`, `/sms/{smsId}/media/{mediaIndex}`
- [ ] Vonage `/sms/json`
- [ ] Twilio Verify emulation (services, start/check/update, fixed codes, limits, force state)
- [ ] Provider port serving real provider paths
- [ ] GSM-7/UCS-2 encoding and segments
- [ ] Delivery simulation (profiles, failure rate, Twilio magic numbers, extensions, strict mode, custom outcome numbers)
- [ ] Status callbacks (Twilio, Vonage) and inbound SMS simulation
- [ ] CLI `sms` / `verify`; MCP `sms`, `verify` toolsets
- [ ] SMS and Verify screens switched to live mode
- [ ] Done-when check: Twilio-shaped send with callbacks; Verify OTP login works; beta released

### Phase 3: Webhooks backend

- [ ] Endpoints, rules, persistent queue, retries, cancel
- [ ] Standard Webhooks signing and secret rotation
- [ ] Email delivery outcome simulation and events (including custom outcome addresses)
- [ ] Opened events and `/open` endpoints
- [ ] Twilio and Vonage inbound/status formats with signatures
- [ ] SMS reply webhook (Twilio style): number and Messaging Service inbound URLs, TwiML replies, fallback URL, Twilio error codes (moved from Phase 4)
- [ ] Variables and `minijinja` templating, `/webhooks/render`
- [ ] Payload templates (native, Twilio, Vonage, Slack, Discord) and custom templates
- [ ] Manual send, replay, edit-and-replay
- [ ] Saved deliveries and `/stats`
- [ ] Seed file covers all configuration; `reset` restores seed; `seed export/apply`
- [ ] CLI `webhook`; MCP `webhooks`, `templates`, `variables` toolsets
- [ ] Webhook screens switched to live mode
- [ ] Done-when check: inbound email rule to Express handler, retry then replay succeeds
- [ ] Beta released

### Phase 3P: Payment gateway backend

- [ ] Native payments API and hosted checkout flow
- [ ] Test cards and the real-card safety rule
- [ ] Stripe emulation with `Stripe-Signature` webhooks
- [ ] PayPal emulation (Orders v2, webhooks, IPN postback)
- [ ] SSLCommerz emulation (init, IPN, validation, refund, query)
- [ ] Done-when check: Stripe, PayPal and SSLCommerz flows end to end offline; beta released

### Phase 4: Integrations, fidelity and AI

- [ ] Email provider send APIs (SendGrid, Mailgun, Postmark, Resend, SES v2, Brevo)
- [ ] HTML compatibility, link check, SpamAssassin check
- [ ] Release to real SMTP, auto-forward, tag rules
- [ ] Inbound email formats (SendGrid Parse, Mailgun routes, Postmark)
- [ ] Bounce/complaint/delivered and open provider formats
- [ ] Fake data functions, Postman aliases, `SENDMOCK_VAR_*`
- [ ] Remaining built-in templates, import/export, `--templates-dir`, revisions
- [ ] More SMS providers (Plivo, MessageBird, generic GET/POST)
- [ ] Email replies and inbound routes (Mailgun style): reply, reply all and forward as recipient, `email.inbound`, inbound domains, routes, `/v3/routes` API
- [ ] WhatsApp via Twilio
- [ ] HTTP catcher backend (bins, mock responses, core presets, `wait/http`)
- [ ] Virtual numbers backend and chaos toggles
- [ ] SDK redirection recipes verified per SDK
- [ ] `examples/` apps for 8 languages with CI smoke tests
- [ ] OpenAPI published, API docs page in UI
- [ ] AI: scenarios, MCP resources/prompts, streamable HTTP, agent skill, `sendmock ai install`, `llms.txt`
- [ ] Done-when check: example apps pass; agent session works in Claude Code and Codex
- [ ] Beta released

### Phase 5: Distribution and 1.0 stable

- [ ] Release builds for all 6 targets, checksums, install scripts with `--channel`
- [ ] Docker stable tags, `-debug` variants, SBOM, provenance, cosign, image smoke test
- [ ] Homebrew tap (`sendmock`, `sendmock-beta`), Scoop bucket, npm wrapper
- [ ] Testcontainers modules
- [ ] Remaining catcher presets and catch-all port
- [ ] Performance and size budgets enforced in CI
- [ ] `sendmock --demo`
- [ ] Claude Code plugin, MCP registry listing, skill evals
- [ ] Website docs complete, versioned (`/`, `/next/`, `/v0.x/`)
- [ ] Final product name applied everywhere
- [ ] **Release `1.0.0`** (Stable release, Promote stable, Publish stable)
- [ ] `main` set as default branch
- [ ] Done-when check: installs and runs via every channel on macOS, Linux, Windows

---

## Decisions

### Made

| Date | Decision | Where |
|------|----------|-------|
| 2026-10-24 | Rust backend, single binary, SQLite; Bun + Vite + React + shadcn/ui frontend embedded | [02](02-architecture.md) |
| 2026-10-24 | UI first with mock data (MSW); backend starts only after UI sign-off | [11](11-roadmap.md) |
| 2026-10-24 | Every feature reachable from UI, REST, CLI, MCP and agent skill (one operation registry) | [14](14-ai-integration.md) |
| 2026-10-24 | Webhooks signed with Standard Webhooks, not a custom scheme | [05](05-webhooks.md#signing) |
| 2026-10-24 | SMS magic numbers match Twilio's official test numbers and error codes | [04](04-sms.md#delivery-simulation) |
| 2026-10-24 | Email accepted via SMTP and provider HTTP APIs; Twilio Verify emulated | [03](03-email.md), [04](04-sms.md) |
| 2026-10-24 | Docker is a first-class release channel | [09](09-distribution.md#docker) |
| 2026-10-24 | `develop` = beta, `main` = stable, releases cut by workflows (phpdebugger model) | [16](16-website-and-releases.md) |
| 2026-10-24 | Website on GitHub Pages with Fumadocs + Magic UI, API playground with in-browser demo mode | [16](16-website-and-releases.md) |
| 2026-10-25 | Add a fake payment gateway (Stripe, PayPal, SSLCommerz first; bKash, Razorpay, Paddle next) with test checkout and IPN; only test cards accepted | [17](17-payments.md) |
| 2026-10-25 | Publish from the `shibbirweb` GitHub account | [10](10-open-questions.md) |
| 2026-10-25 | Commits authored as `MD. Shibbir Ahmed <shibbirweb@gmail.com>` (rule in `AGENTS.md`); existing local commits rewritten before the first push | [AGENTS.md](../../AGENTS.md#commits-and-pull-requests) |
| 2026-10-25 | Product name **SendMock** (binary and packages `sendmock`) | [10](10-open-questions.md#1-product-name-decided-2026-10-25-sendmock) |
| 2026-10-25 | SQLite is the only database: embedded (`rusqlite`, bundled, FTS5), one file, WAL mode, on disk at the OS data directory by default and `--db memory` for CI, hand-rolled `user_version` migrations | [02](02-architecture.md#database-sqlite) |

### Open

See [10-open-questions.md](10-open-questions.md). Summary:

| Question | Recommendation | Status |
|----------|----------------|--------|
| Trademark check for "SendMock" | search USPTO, EUIPO, WIPO before branding | Open |
| Default ports | 1025 / 8025 (Mailpit compatible) | Open (using recommendation) |
| Licence | dual MIT / Apache-2.0 | Open |
| Provider emulation priority | Twilio, Vonage, generic, then others | Open (using recommendation) |
| SDK redirection per SDK | verify in Phase 4 | Open |
| Attachment storage | inside SQLite | Open (using recommendation) |
| Telemetry | none, opt-in update check | Open (using recommendation) |
| Mailpit API aliases | after 1.0 if demanded | Open |
| Persistence default | on-disk SQLite, `--db memory` for CI | Decided 2026-10-25 |
| caniemail data licence | confirm before shipping | Open |
| Lenient vs strict provider emulation | lenient default, strict mode per provider | Open (using recommendation) |
| Docs-site CORS default for local playground | allow docs origin, connect on click | Open |
| Fumadocs static export and search on Pages | confirm in U0 | Open |
| Magic UI MCP command for Claude Code | confirm in U0 | Open |

## Update log

| Date | Update |
|------|--------|
| 2026-10-24 | Plan written (docs 01 to 16), competitor research folded in, plan moved to `docs/plan/`, progress tracker created, `AGENTS.md` / `CLAUDE.md` added, acceptance criteria written for all features. |
| 2026-10-25 | Phase U0 started on `feat/u0-ui-foundations`: web app shell, mock API with realtime events and demo controls, tests (27 unit, 7 end-to-end), CI and Pages workflows, website skeleton with Magic UI. Waiting on the GitHub repository for the remaining four items. Note: the demo-only mock chunk is 308 KB gzipped (faker data); the app bundle is 172 KB, inside budget. |
| 2026-10-25 | PR #1 merged into `develop`: CI (Web UI, Acceptance traceability, Website) green on the PR and on `develop`; site live at https://shibbirweb.github.io/sendmock/ with the demo at `/demo/`. Rulesets protect `develop` and `main`; required status checks still to be added. |
| 2026-10-25 | Mail screen built on mock data: virtual list with infinite loading, search with filter chips, keyboard shortcuts, sandboxed HTML preview with device widths and screenshot, Source/Headers/Attachments/MIME/Checks/Timeline/Template tabs, simulate open and delivery outcomes, release, bulk actions, browser notifications. Also: collapsed sidebar logo fixed, toasts dismissable. |
| 2026-10-25 | SMS conversations built on mock data: thread list with search and SMS / WhatsApp chips, chat bubbles with WhatsApp styling, status ticks (queued, sent, delivered, read, failed with Twilio error code), segment, encoding, API and Messaging Service badges, OTP copy, read on view, "Simulate read", "Reply as recipient" composer. Mock sends now move through queued, sent and delivered live. Demo controls moved into the header so they never cover page content. |
| 2026-10-25 | SMS message drawer built on mock data: status timeline with time between steps, request JSON with a request log link, status callback attempts with request and response (Twilio form or JSON), manual Delivered / Undelivered / Failed with an error code picker. The mock `manual` profile now stops at `sent`, as the plan says. |
| 2026-10-25 | Plan: email replies and inbound routes that work like Mailgun Routes ([05](05-webhooks.md#email-replies-and-inbound-routes-mailgun-style), EM-17, WH-12, Phase 4) and an SMS reply webhook that works like Twilio's ([04](04-sms.md#reply-webhook-twilio-style), SM-09.4 to SM-09.7). TwiML replies moved from Phase 4 to Phase 3; reply UI added to U2. |
| 2026-10-25 | Plan: reply, reply all and forward as recipient for email (inline composer design in [07](07-ui.md#mail), `/emails/{emailId}/forward`, EM-17.4 and EM-17.5). The email reply UI moves from U2 into U1, next to the rest of the Mail screen. |
| 2026-10-25 | Mail reply, reply all and forward as recipient built on mock data: inline composer that puts the quote or forwarded-message block in the message box like Gmail, editable subject and From, forward suggestions from the inbound domains, Inbound badge, "Reply to" / "Forward of" links and a "Replies and forwards" row, timeline entries, `is:inbound`, R / Shift+R / F, discard prompt. The demo mailbox now includes a customer reply. |
| 2026-10-25 | Plan: Verify tab design ([07](07-ui.md#sms): verifications table with live expiry countdown, status chips, detail drawer with timeline, linked message and force buttons, Services tab with create / edit / delete dialog) and criteria VF-01.3 and VF-04.4. |
| 2026-10-25 | Verify tab built on mock data: verifications table with a live expiry countdown, status chips and search, detail drawer with timeline, force buttons and a link to the SMS that carried the code, Services tab with create / edit / delete and the shared validation rules. Pending codes past their expiry turn expired on the next fetch. Shared `FilterChip` now used by Mail, SMS and Verify. |
| 2026-10-25 | Fix: buttons, tabs, checkboxes, select triggers, menu items and `<summary>` show the pointer cursor again (Tailwind v4 dropped it); disabled buttons keep the default cursor. |
| 2026-10-25 | Plan: Numbers screen design ([07](07-ui.md#numbers): numbers table and side sheet with inbound URL, method, fallback, format and status callback; Messaging Services with sender pool and inbound handling) and criteria SM-03.4 and SM-12.3. |
| 2026-10-25 | Numbers screen built on mock data: numbers table and side sheet (E.164, channels, inbound webhook URL, method, fallback and format, default status callback, Messaging Service, note when an `sms.inbound` rule also exists), Messaging Services with sender pool (moving a number between pools updates both) and inbound handling. Shared `FormField`, `FormFieldError` and `ConfirmDeleteDialog` now also used by Verify. |
| 2026-10-25 | Plan: Logs screen design ([07](07-ui.md#logs): SMTP sessions with a colour-coded transcript viewer and a link from each email to its session, HTTP API request log with formatted bodies, filters and message links) and criteria EM-09.4 and SM-13.4. |
| 2026-10-25 | Logs screen built on mock data: SMTP sessions (failed ones highlighted with their reason, transcript viewer with C / S lines and reply codes coloured by class, each SMTP email linked to its session and back) and the API request log (status class, API and path filters, JSON and form bodies formatted, links to the SMS or email created and back). Both tables page 50 rows at a time and load more on scroll; the large data set now has about 5,000 sessions and 2,000 requests. Native sends are logged live. |
| 2026-10-25 | Fix: `web/.gitignore` ignored every folder named `logs`, which hid `src/features/logs` from git, Tailwind, Prettier and ESLint; the rule is now anchored to the root (`/logs/`). Demo control labels are now tied to their selects. |
| 2026-10-25 | Plan: Settings screen design ([07](07-ui.md#settings): section nav, per-section save with field errors, General, Seed, Email, SMS, Opened events, Chaos, OTP patterns, Connection, About), `/seed/validate` and `/seed/status` in the API plan, criteria PL-04.6, PL-05.3, PL-05.4 and EM-05.5. Tag and auto-forward rules are edited with the U2 rule builder. |
| 2026-10-25 | Settings screen built on mock data: section nav (picker on phones) with a "Chaos on" badge, per-section Save / Discard with validation shared with the API, General (retention, delete all, reset to seed), Seed (status, export, validate with line numbers, apply), Email (plus addressing, outcome profile and rates, inbound domains, masked relay URL and allowlist, SpamAssassin, magic addresses), SMS (profile, failure rate, strict mode, magic numbers), Opened events, Chaos, OTP patterns with a live tester, Connection snippets for 8 languages and 3 app locations, About with the opt-in update check. Shared `RadioCardGroup`, `ChipListInput` and `ConfirmActionDialog`. |
| 2026-10-25 | Plan: Settings > Connection gets "Customize the request" (request headers and the optional `/send` and `/sms` payload fields, reflected in every language's snippet), criterion PL-05.7. |
| 2026-10-25 | Settings > Connection: "Customize the request" adds request headers (with a quick Authorization header) and editable JSON bodies with chips for the optional `/send` (`cc`, `bcc`, `text`, `tags`, `headers`) and `/sms` (`status_callback`, `metadata`) fields; every language's snippet follows in its own syntax. |
| 2026-10-25 | Plan: native send `attachments` defined ([03](03-email.md#native-send-attachments): `filename`, base64 `content`, optional `content_type` and `content_id`, 400 errors naming the attachment), criteria EM-07.4, EM-07.5 and PL-05.8; Connection gets an `attachments` chip and `{{file:<name>}}` values that each snippet reads and encodes. |
| 2026-10-25 | Plan: SQLite recorded as the database decision ([02](02-architecture.md#database-sqlite): why, location and modes, connection setup, migrations with `user_version`, search, retention, tests); persistence default decided. |
| 2026-10-25 | Native send attachments in the mock (`/send` stores them with real bytes, inline `cid:` images display, 400 errors name the attachment) and an `attachments` chip in Connection, where `{{file:...}}` values make each snippet read and encode the file. |
| 2026-10-25 | Plan: MMS and media ([04](04-sms.md#mms-and-media): Twilio `MediaUrl` with stored copies, native `media_urls` and inline base64 `media`, 10 items and 5 MB, `/sms/{smsId}/media/{mediaIndex}`, reply webhook `MediaUrl{N}`, UI thumbnails, drawer list and attach in the composer), feature SM-15 and criterion PL-05.9. |
| 2026-10-25 | MMS and media built on mock data: native `/sms` accepts `media_urls` and inline base64 `media` (10 items, 5 MB, 400 errors naming the item), `/sms/{smsId}/media/{mediaIndex}` serves the files, bubbles show image thumbnails and file chips with an MMS / Media badge, the drawer lists media, "Reply as recipient" attaches files, Connection has `media` and `media_urls` chips. The demo includes an MMS booking with a QR code and PDF, and a WhatsApp photo. Email attachments and SMS media share one base64 file parser. |
| 2026-10-25 | Settings > Connection: "Customize the request" gets a Reset button that restores the sample bodies and removes added headers; the email and SMS body columns now line up. |
| 2026-10-25 | Plan: custom outcome numbers ([04](04-sms.md#custom-outcome-numbers)) and custom outcome addresses ([03](03-email.md#delivery-outcome-simulation)) as ordered, switchable rules checked before the read-only magic numbers and addresses, with Magic numbers / Magic addresses switches, "Test a number / address" boxes and `/outcome-rules/sms` and `/outcome-rules/email`; criteria SM-07.7 to SM-07.9, EM-10.5, EM-10.6. |
| 2026-10-25 | Custom outcome numbers and addresses built on mock data: ordered rule tables with on / off, move, edit and delete, dialogs that ask only for what an outcome needs, "Test a number / address" boxes, Magic numbers and Magic addresses switches, rules exported to the seed file. Mock sends now follow custom rules and the magic numbers and addresses (reject on send, failure codes, delayed delivery, read, bounces). |
| 2026-10-25 | Plan: Overview dashboard design ([07](07-ui.md#overview): KPI row with today's counts, 24-hour activity chart with tooltip and table view, webhook metrics per endpoint, recent failures, latest messages, connect shortcuts), richer `/stats` in the API plan, criteria UI-03.3 to UI-03.5. Chart colours checked for colour-blind separation and contrast in both themes. |
| 2026-10-25 | Overview dashboard built on mock data: stat tiles with totals and today's counts, a 24-hour stacked activity chart (legend, tooltip on hover and arrow keys, "Show as table"), webhook health per endpoint with a success meter, p50 / p95, retries and top failure codes, recent failures linking to the delivery, latest messages and a connect card with copy buttons. `/stats` mock computes the new fields. |
| 2026-10-25 | Plan: empty states ([07](07-ui.md#empty-states--onboarding)): "no data yet" (how to connect card with copyable values and a sample button per screen) told apart from "nothing matches" (Clear filter); the host follows a shared, remembered "Where does your app run?" choice that defaults to the Compose host in Docker. New `POST /samples/{kind}` (email over SMTP, SMS, verification) with CLI and MCP, `is_container` on `/info`; criteria UI-04.3, UI-04.4, PL-03.5. |
| 2026-10-25 | Empty states built on mock data: Mail, SMS, Verify, Numbers, both Logs tabs and the Overview show a how to connect card (copyable host and ports from `/info`, a shared and remembered "Where does your app run?" switch that defaults to the Compose host in Docker) and a sample button; filters that match nothing offer Clear filter instead. Mock `POST /samples/{kind}` creates the email with its SMTP session, the SMS with its API log entry and a pending verification. Demo controls gain a "Running in Docker" switch. |
| 2026-10-25 | Plan: webhook endpoints screen in detail ([07](07-ui.md#webhooks)): table with enabled switch, 24-hour success sparkline and Docker hint; edit sheet tabs General, Template (picker, link mode, overrides), Security (reveal with confirmation, rotate with overlap), Retries (validated schedule with preview), Variables (template's required variables); Send test result dialog. API: `delivery_count_24h` and `success_history` on endpoints, `GET .../secret` reveal; criteria WH-01.5 to WH-01.8. |
| 2026-10-25 | Webhook endpoints built on mock data: table with enabled switch, 24-hour success sparkline and Docker hint; edit sheet with General, Template (searchable picker, link mode, header and field overrides), Security (confirmed reveal, rotation with overlap), Retries (validated delays, schedule preview) and Variables (template's required variables, text and secret endpoint variables); Send test result dialog. Mock fixtures gain a day of delivery history, so sparklines and the Overview chart show trends. |
| 2026-10-25 | Plan: webhook rules screen in detail ([07](07-ui.md#webhooks)): ordered list with filter summaries and endpoint filter; editor sheet with grouped events and a filter builder (all / any groups, not toggle, one nested group, field-aware value inputs, inline checks); live preview against the last 50 messages. Matching semantics written down in [05](05-webhooks.md#rules-automatic-mode); `preview` request and response and `move` in the API plan; criteria WH-02.5 and WH-02.6. |
| 2026-10-25 | Webhook rules built on mock data: ordered list with move up / down, event chips, plain-language filter summaries, enabled switch and an endpoint filter in the URL; editor sheet with grouped event checkboxes, a visual filter builder (all / any, not on rows and groups, one nested group, field-aware value pickers, inline checks) and a live preview of the last 50 messages. The filter engine (fields, operators, evaluation, validation, builder conversion, summaries) is shared by the UI and the mock API. |
| 2026-10-25 | Plan: webhook deliveries in detail ([07](07-ui.md#webhooks)): paged live log with status, endpoint and event filters; detail drawer with request and response side by side, every attempt of the event, the causing message, and Copy as cURL, Replay (as-is or re-rendered), Edit and replay, Cancel retries and Save. API: log filters, detail extras, replay body and saved delivery body; criteria WH-03.7 to WH-03.9. |
| 2026-10-25 | Webhook deliveries built on mock data: paged live log with status, endpoint and event filters; detail drawer with request and response side by side, every attempt of the event, the causing email or SMS, Copy as cURL, Replay as-is or re-rendered, Edit and replay (JSON checked), Cancel retries and Save. The mock now fires enabled matching rules in order when emails and SMS arrive, so deliveries appear live. `webhook.delivered` documented as the live-log event that rules cannot pick. |
| 2026-10-25 | Plan: Saved screen in detail ([07](07-ui.md#webhooks)): searchable list with the stored request, Send to any endpoint with optional re-render and a result, Rename, Delete, Save as template; saved deliveries survive reset and go into the seed export without signature headers. API: `PATCH /webhooks/saved`, `send` and `template` bodies; criterion WH-10.4. |
| 2026-10-25 | Saved deliveries built on mock data: searchable list that opens to the stored headers and body, Send to any endpoint with optional re-render and a result linking to the new delivery, Rename, Delete and Save as template. Saved deliveries now survive reset in the mock and are written to the seed export without signature headers. The save dialog became a shared name prompt. |
| 2026-10-25 | Plan: templates gallery and detail ([13](13-webhook-templates.md#ui)): cards with category tabs, search and event filter in the URL; detail sheet with request shape, doc link and verified date, live preview against a recent message or the sample with undefined-variable warnings, Use in new endpoint, Clone, Export and Delete with detach-or-cancel. API: template detail, render, clone, export and delete rules; criteria WH-08.4 and WH-08.5. |
| 2026-10-25 | Templates gallery and detail built on mock data: cards with category tabs, search and an event filter in the URL; a detail sheet with events, required variables, request shape, provider doc link and verified date, and a live preview against the sample or a recent email or SMS listing undefined variables; Use in new endpoint, Clone, Export (TOML) and Delete with detach-or-cancel. Every built-in template has a request shape in the mock, rendered by a small stand-in for the template engine. Design tokens gain a warning colour. |
| 2026-10-25 | Plan change: built-in templates are editable in place ([13](13-webhook-templates.md#using)) with a Modified badge and Reset to default (asks first), instead of read-only with clone-to-freeze; upgrades never overwrite a modified template. A basic Edit form in the template detail (method, content type, headers, body, live preview of the draft, errors block saving) comes now; the full editor stays a separate item. API: template `PATCH`, `reset`, `draft` in render; criteria WH-09.7 and WH-09.8. |
| 2026-10-25 | Built-in templates are editable: a basic Edit form in the template detail (method, content type, header templates, body) previews the draft live, blocks saving on errors (unknown functions or filters, unbalanced braces) and lists undefined variables as warnings. An edited built-in shows Modified in the gallery and detail, endpoints linked to it see the new revision, and Reset to default restores the shipped template. File templates stay read-only. Edited built-ins and custom templates go into the seed export. |
| 2026-10-25 | Plan: template editor details ([13](13-webhook-templates.md#creating)): New template, editing a custom template's name, description, events and required variables, Save as template from an endpoint, Import (TOML or JSON, Replace or Import as copy on an id clash), and History with line diff and Restore for custom and edited built-in templates. API rows for create, import, revisions, restore and endpoint save-as-template; criterion WH-09.9. |
| 2026-10-25 | Template editor built on mock data: New template opening in the editor, custom template name, description, events and required variables, Save as template from an endpoint (extra headers and fields folded in), Import from TOML or JSON with Replace or Import as copy on an id clash, and History (last 20 revisions) with Compare and Restore. Fixed: a name dialog inside the endpoint sheet also saved the endpoint. |
| 2026-10-25 | Plan: template reference panel and `{{` suggestions ([12](12-webhook-variables.md#template-reference-and-suggestions)), WH-07.9 and WH-07.10, added as a U2 item before the request editor; notification settings with a bell-only mode, header bell and notification list ([07](07-ui.md#notifications)), new feature UI-08, scheduled in U3. |
| 2026-10-25 | Template reference and suggestions built on mock data: the template editor has a searchable reference panel (event, data shaped by the template's events, vars, endpoint, delivery, rule, sendmock, request_id, functions and filters, each with type, description and an example; click to insert) and suggestions at the caret while typing inside `{{ }}` in the body and header values (keys, children after a dot, filters after `|`, functions; arrows, Enter or Tab, Esc). The reference lists exactly the functions and filters the preview renderer supports. |
| 2026-10-25 | Plan: Variables screen in detail ([07](07-ui.md#webhooks)): table with scope, kind and name filters; add / edit sheet with fields per kind (JSON checked, secrets write-only, suggestions for Dynamic, Random and Computed, Random Per send or Fixed with Regenerate) and a Resolves to preview. API: per-kind checks, masked secrets, `fixed_value`, `POST /webhooks/variables/preview`; criteria WH-07.11 to WH-07.13. |
| 2026-10-25 | Variables screen built on mock data: table of global and endpoint variables with scope (in the URL), kind and name filters; add / edit sheet with fields per kind (number, boolean switch, checked JSON, write-only secret that an empty edit keeps, Dynamic and Random expressions with suggestions, Computed templates, Prompt default), a Resolves to preview against the sample email whose errors block saving, and Fixed random values with Regenerate. The endpoint sheet's Variables tab links here for the other kinds. |
