# Progress Tracker

Where the project stands, what is done, and what is left. The plan itself is in [README.md](README.md) and the phase details in [11-roadmap.md](11-roadmap.md); this file only tracks status.

**Last updated:** 2026-10-25

## Current position

| | |
|---|---|
| **Stage** | Stage A: UI with mock data |
| **Current phase** | **Phase U3: polish, website, contract freeze and sign-off** ([18](18-phase-u3.md)), starting with W1 design review guards (U2: 14 / 14) (U1: 18 / 18) (U0: 14 / 15, required CI checks still to add) |
| **Latest release** | none yet (first beta `0.1.0-beta.1` is planned for Phase 1) |
| **Blockers** | none |
| **Live preview** | https://shibbirweb.github.io/sendmock/ (demo at `/demo/`), published from `develop` |
| **Feature acceptance** | 0 / 99 accepted, 10 / 426 criteria ticked; the U1 screen features are in progress with their UI criteria tested on mock data ([acceptance/](acceptance/README.md)) |

**Next up:**

1. Add the required status checks (Web UI, Acceptance traceability, Website) to the `develop` and `main` rulesets.
2. Phase U3 in the order of [18-phase-u3.md](18-phase-u3.md): W1 design review guards first.

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
| U2 | Webhook, HTTP catcher and payment screens | In progress | 14 / 14 |
| U3 | Polish, website, contract freeze, **sign-off gate** | In progress | 10 / 12 |
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
- [x] Request editor: CodeMirror, `{{` autocomplete, body modes, live nunjucks preview, inline errors (endpoint sheet Request tab: query params, headers, Template / Fields / Raw / None, Strict or Lenient, Insert menu, hover values; live preview with problems under each part and underlined at line and column; the template body uses the same editor; WH-07.14, WH-07.15)
- [x] Manual send dialog and composer (Prompt variables, overrides; Send to webhook from Mail and SMS with format, live preview, Edit body, Open delivery and Save; Composer at `/webhooks/composer` with template presets and the request editor; WH-05.1, WH-05.3, WH-05.5, WH-05.6)
- [x] HTTP catcher: bins, requests, Slack/Discord/push previews, response rules, forward (bins from presets with catch URL, clear and delete; live request list; detail with previews, pretty or raw body, files, headers, query and the response with its rule; Copy as cURL, Forward to URL, Send to webhook; Responses tab with ordered rules, live rule preview and default reply; HC-01.6, HC-01.7, HC-02.4)
- [x] Webhooks overview metrics (`/webhooks/overview`: 24 hours or 7 days and an endpoint, kept in the URL; stat tiles; deliveries over time stacked by succeeded / retrying / failed with tooltip, p50 / p95 and table; per-endpoint metrics; top failure codes linking to failed deliveries; recent failures; live; WH-11.1, WH-11.3)
- [x] Payments list, detail and Simulate menu; hosted test checkout page with provider themes; Gateways, Methods and Flows (add, edit, reset to default; flows composed step by step); Settings > Payments
  - [x] Part 1: payments list, detail and Simulate menu
  - [x] Part 2: hosted test checkout page with provider themes
  - [x] Part 3: payment methods (add, edit, reset, delete) and a method-driven checkout
  - [x] Part 4: payment flows (PY-12.6): flow and step types in the API contract; step catalogue and flow validation shared by the UI and the mock API; seven built-in flows in the mock DB with reset; `/payments/flows`, single-step and `/payments/step-types` handlers; methods point at a flow key and their test value fields follow its steps; the checkout page runs a flow's steps in order through a step registry (one component per step type) and the mock checks each step; Payments > Flows table, Add flow and the step-by-step edit sheet; unit and e2e tests
  - [x] Part 4b: step label variables (PY-12.7): a Variables reference in the flow sheet, an Insert variable menu on every label, a filled preview per step, unknown variables refused on save, all seven filled in on the checkout page, and `GET /payments/flow-variables`
  - [x] Part 5a: Gateways screen (PY-12.2, PY-12.3 custom gateways, PY-12.4): gateway definitions in the API contract and mock DB (the five built-ins as data, reproducing today's redirect and notification shapes); redirects and notifications rendered from the gateway's templates; `/payments/gateways` with reset, preview, secret reveal and `POST /payments/checkout` for a test checkout; payments show the gateway's name; Payments > Gateways table, Add gateway (from a built-in or blank) and the tabbed edit sheet with a live preview; unit and e2e tests
  - [x] Part 5b: Settings > Payments (merchant name, default currency, automatic outcome profile, test value tables) and the Overview payments tile
- [x] Replies: Inbound routes list and editor, SMS reply webhook result and drawer tab, inbound URL and fallback on Numbers
  - [x] Numbers: inbound URL, method, fallback URL and format per number, and the Messaging Service inbound setting (built in U1)
  - [x] R1: SMS reply webhook result (SM-09.7): inbound messages go to the service or number URL (fallback with `ErrorCode` and `ErrorUrl` when the primary fails); the result line under inbound bubbles; TwiML replies stored in the thread with a "TwiML reply" badge; the drawer's Reply webhook tab with attempts, request, response, parsed TwiML and Resend reply webhook; `POST /sms/{smsId}/reply-webhook/resend`
  - [x] R2: Inbound routes (WH-12.7): `/webhooks/inbound-routes` list by priority, editor sheet for the filter and actions in Mailgun syntax with the "matches N of the last 50" preview; incoming emails run matching routes, forwards in the email timeline and the delivery log; `/api/v1/inbound-routes` with a test endpoint

### Phase U3: Polish, website, contract freeze, sign-off gate

Plan: [18-phase-u3.md](18-phase-u3.md). Work in this order (W1 to W11):

- [x] Design review pass on every screen (hierarchy, spacing, microcopy, empty/loading/error states)
  - [x] W1 Guards: design token check (UI-07.1), page titles on every screen (UI-07.4), simulated API errors for every endpoint, a shared error state, and a states test that opens every screen with errors, empty data and slow responses (UI-07.2), fixing what it catches
  - [x] W6 Pass: light and dark screenshots of every screen reviewed against the checklist (including the sidebar chevron on groups with sub-items); fixes made and the review table filled in
- [x] Notification settings: show or hide pop-up toasts, toast position, header bell with unread count and a notification list ([07](07-ui.md#notifications), UI-08) (W2)
- [x] Accessibility pass: axe on every screen in both themes, keyboard-only flows, focus, labels, reduced motion (UI-05) (W3)
- [x] Responsive check: every screen from 360 to 2560 wide, no horizontal scroll, panes and tables adapt (UI-01.1) (W4)
- [x] Performance with large data: initial JS under 250 KB gzipped, lazy routes and editors, virtualised lists, opening an email under 200 ms, `dist/` under 2 MB (UI-06) (W5)
- [x] OpenAPI contract frozen at `docs/api/openapi.yaml`, generated from an endpoint registry and the API types, with drift checks (UI-09) (W7)
- [x] Website landing page with Magic UI (animated beam, terminal, marquee, bento grid, number ticker), reduced motion, Lighthouse 90+ (WS-02) (W8)
- [x] Website docs structure drafted (`docs/wiki/`), synced into the site, links checked (W9)
- [x] API reference and playground in Demo mode: reference from the spec, request builder, snippets in nine languages, event stream, scenario mode (WS-04) (W10)
- [x] Community links and GitHub templates: Help menu (docs, shortcuts, changelog, report an issue, request a feature, security, star), website links, issue forms, PR template, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT (UI-10) (W12)
- [ ] Feedback round on the preview URL, iterations done, design review table signed off (UI-07.3) (W11)
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
| 2026-10-25 | Plan: request editor placement and contract ([07](07-ui.md#webhooks)): the endpoint sheet's Request tab (query params, headers, body mode Template / Fields / Raw / None, Strict or Lenient, live preview with problems under each part and at line and column), CodeMirror 6 lazy loaded and justified in [12](12-webhook-variables.md#editor-experience-ui), also used for the template body. API: endpoint request fields and `POST /webhooks/endpoints/preview`; criteria WH-07.14 and WH-07.15. |
| 2026-10-25 | Request editor built on mock data: the endpoint sheet's Template tab became a Request tab with query params, headers, body mode (Template with picker and extra fields, typed Fields encoded as JSON or a form, Raw in a lazy-loaded CodeMirror editor, None) and Strict or Lenient rendering; `{{` completion, hover values (secrets masked), an Insert menu and a live preview against the sample or a recent email or SMS, with each problem under its part and underlined at its line and column. The template editor body uses the same editor. Template data gains `data.extracted` (OTP codes and links). |
| 2026-10-25 | Plan: Send to webhook dialog and Composer in detail ([07](07-ui.md#webhooks)): endpoint and format, Prompt variables prefilled with defaults, per-send overrides, live preview, Edit body, result with Open delivery and Save; the composer at `/webhooks/composer` with a target endpoint, template presets and the request editor. API: `POST /webhooks/endpoints/{endpointId}/send` fields and preview `variables`; criteria WH-05.5 and WH-05.6. |
| 2026-10-25 | Send to webhook and Composer built on mock data: Mail and SMS menus open a dialog with endpoint (starting on one whose template fits the message), format, Prompt variables prefilled with defaults, per-send overrides, a live preview, Edit body (sent as written), and a result with Open delivery and Save; render errors block sending. The Composer (`/webhooks/composer`, in the Webhooks nav) sends a hand-written request to an endpoint, starting blank or from any template preset, with the request editor, variables and preview. Mock: `POST /webhooks/endpoints/{endpointId}/send` records a signed `manual` delivery or `render_failed`. |
| 2026-10-25 | Fix: the Mail empty state's Clear search no longer comes back after a moment (the search box now follows `?q=` when it changes elsewhere). The code editor accepts a suggestion on Enter at once, like the text fields. Flaky e2e tests fixed in empty states, template suggestions, deliveries paging and logs paging (they raced URL updates, the suggestion selection and automatic page loads on slower CI runners). |
| 2026-10-25 | Plan: HTTP catcher screen in detail ([07](07-ui.md#http-catcher)): three columns with bin, tab and request in the URL; bins from presets with catch URL, clear and delete; live request list; detail with Slack, Discord and push previews, pretty or raw body, files, headers, query and the response sent with its rule; Copy as cURL, Forward to URL, Send to webhook; Responses tab with ordered rules (method, path glob, header and body conditions, templated response, delay, failure rate), default reply and a live rule preview. API rows in [06](06-api.md#http-catcher); criteria HC-01.6, HC-01.7 and HC-02.4. |
| 2026-10-25 | HTTP catcher built on mock data (`/http`): bins with presets (Slack, Discord, Teams, Google Chat, Telegram, FCM, Expo, OneSignal, Generic JSON) setting the default reply; requests live, 50 at a time; detail with Slack Block Kit, Discord embed and push notification previews, pretty or raw body (multipart fields parsed, files to download), headers, query and the response sent with the rule that produced it; Copy as cURL, Forward to URL and Send to webhook (as an `http.captured` event). Responses tab: ordered rules matching method, path glob and header / body conditions (the webhook filter builder), templated status, headers and body, delay range and failure rate, with a live preview against a captured request; editable default reply. Webhook sends to a `/catch/...` URL now land in the catcher and get its reply. The mock template renderer treats a lone `}}` as text, as Jinja does, so JSON bodies ending in `}}` no longer report unbalanced braces. |
| 2026-10-25 | Plan: Webhooks overview in detail ([07](07-ui.md#webhooks)): `/webhooks/overview` as the first Webhooks screen with range (24 hours or 7 days) and endpoint filters, stat tiles, deliveries over time stacked by succeeded / retrying / failed with tooltip (p50 / p95) and table, per-endpoint metrics, top failure codes and recent failures. API: `GET /webhooks/metrics`; criterion WH-11.3. |
| 2026-10-25 | Webhooks overview built on mock data (`/webhooks/overview`, now the first Webhooks screen): range (24 hours hourly or 7 days daily) and endpoint filters in the URL, stat tiles, deliveries over time stacked by succeeded, retrying and failed (the validated chart tokens; the status colours failed the CVD check when stacked) with the hover and keyboard tooltip, p50 / p95 latency and a table view, per-endpoint metrics (a row narrows to that endpoint), top failure codes linking to the deliveries log on the Failed chip (`?status=failed&endpoint=`), and recent failures, updated live. Mock: `GET /webhooks/metrics`; delivery history now spans 7 days and only recent failures still have a retry scheduled. The Overview activity chart and this one share a generic stacked column chart. |
| 2026-10-25 | Plan: Payments screen in detail ([07](07-ui.md#payments)): list with status, provider and currency filters in the URL, live; detail drawer with ids, customer, method, line items, timeline, redirects and linked notifications; Simulate menu offering only what the status allows (refund capped at what is left). Notifications are deliveries to the provider's notification endpoint set in Settings > Payments ([17](17-payments.md#ui)). Delivered in three pull requests: list and Simulate, test checkout page, Settings > Payments. |
| 2026-10-25 | Payments list, detail and Simulate built on mock data (part 1 of 3; the item is ticked with the last part): `/payments` (new nav entry, `g p`) with status, provider and currency filters in the URL, live; detail drawer with provider ids, customer, masked method, line items, timeline, redirect with its fields, and notifications linking to the delivery log; Simulate menu limited to what the status allows (succeed, decline with reason, expire, capture, void, refund capped at what is left, open and resolve disputes) plus Resend notification. Mock: native `payment.*` and `checkout.*` events, provider-shaped notifications (Stripe, PayPal, SSLCommerz IPN form, bKash, native) sent as deliveries to the "Shop payments" endpoint, and 16 fixture payments built by running the same Simulate steps. |
| 2026-10-25 | Plan: test checkout page in detail ([07](07-ui.md#payments)): standalone `/pay/{sessionId}` with the TEST MODE banner, order summary, provider themes (card form, PayPal approve, SSLCommerz method picker, bKash wallet, OTP and PIN), test controls (pay, decline, cancel, 3-D Secure, delay), the result with where the browser goes and Return to merchant, closed sessions and keyboard use. Test wallets, OTP and PIN and the checkout session endpoints in [17](17-payments.md#test-cards-and-test-wallets). |
| 2026-10-25 | Test checkout page built on mock data (part 2 of 3): standalone `/pay/{sessionId}` (no app shell) with the TEST MODE banner, order summary and provider themes from accent tokens: card form (Stripe, native) following the test card table, PayPal approve as the sandbox buyer, SSLCommerz cards / mobile banking / net banking, bKash wallet, OTP and PIN with test wallets. Test controls (pay, decline with reason, 3-D Secure for cards, delay, cancel), the 3-D Secure challenge, and a result showing the redirect URL, method and fields with Return to merchant (link or POST form). A Luhn-valid real card is refused on the page and by the API and never stored; closed sessions cannot be paid again. Mock: checkout session endpoints and two more open checkouts (PayPal, bKash). |
| 2026-10-25 | Plan: gateways and payment methods become configurable ([17](17-payments.md#gateways-and-payment-methods-configurable), [07](07-ui.md#payments)): Payments > Methods (card, wallet, bank and account flows with their test values) and Payments > Gateways (methods offered, merchant credentials, notification endpoint, redirect fields and notification templates with a live preview), add and edit for both, Modified and Reset to default for built-ins; the checkout page follows the gateway's methods. Settings > Payments keeps the merchant name, currency, outcome profile and test tables. New feature PY-12 (4 criteria). Delivered as part 3 (Methods and a method-driven checkout page) and part 4 (Gateways, Settings > Payments and the Overview tile). |
| 2026-10-25 | Plan: AI can add payment gateways and methods ([14](14-ai-integration.md#prompts), [17](17-payments.md#gateways-and-payment-methods-configurable)): CLI `sendmock payments gateways|methods`, MCP `payments` tools to list, create, update, preview and reset them with the UI's validation, and an `add-payment-gateway` skill workflow and MCP prompt (provider docs to definition, preview, test checkout, seed export). Criterion PY-12.5 (Phase 3P). |
| 2026-10-25 | Payment methods built on mock data (part 3 of 4): Payments > Methods (new nav children All payments and Methods) lists every method with flow, gateways, test values, Built-in / Custom, Modified and an enabled switch; Add method from a flow (card, wallet, bank, account), an edit sheet for name, accent and the flow's test values (test cards limited to the test ranges, wallets with OTP and PIN), Reset to default for built-ins and Delete for unused custom methods. The checkout page now runs each method's flow with its own test values: one method directly, several in a picker grouped by flow (SSLCommerz mobile banking now runs the chosen wallet's number, OTP and PIN), with the gateway's accent colour and readable text. Fixes: the sidebar highlights only the most specific child; a flaky Settings About test matched the footer version. |
| 2026-10-25 | Plan: payment flows are editable too ([17](17-payments.md#gateways-and-payment-methods-configurable), [07](07-ui.md#payments)): Payments > Flows builds a flow from a step catalogue (card form, account number, voucher code, OTP, PIN, signed-in account, QR code, reference code, confirm) with per-step labels; built-ins (Card, Wallet, Bank, Account, QR, Bank transfer, Voucher) are editable with Reset to default, custom flows are added and deleted; a method's test fields follow its flow's steps. Flows are composed one step at a time by hand or by an AI agent through the CLI (`sendmock payments flows steps ...`), MCP flow tools and the `add-payment-flow` skill workflow and prompt ([14](14-ai-integration.md)). Criterion PY-12.6, PY-12.5 extended. |
| 2026-10-25 | Payment flows built on mock data (part 4 of 5): Payments > Flows (new nav child) lists the seven built-in flows (Card, Wallet, Bank, Account, QR, Bank transfer, Voucher) with their steps, picker tab and usage; Add flow (name, key, picker tab, start from one confirm step or a copy of a flow) and an edit sheet that composes the flow one change at a time (add a step from the catalogue, move up or down, remove, edit title, field label, hint and button text with `{method}` and `{amount}`), with problems shown before Save, Reset to default for built-ins and Delete for unused custom flows. Methods now point at a flow key and their test value fields follow its steps (test cards, test numbers or voucher codes, OTP, PIN, test account, or the outcome); the checkout page runs any flow through a step registry, with a drawn test QR code and a payment reference for the new steps. The mock API adds `/payments/flows`, single-step add, update and remove, reset and `/payments/step-types`, shared with the UI's validation so the CLI and MCP can compose flows the same way later. PY-12.6 has tests. |
| 2026-10-25 | Plan: step label variables are documented and checked ([17](17-payments.md#gateways-and-payment-methods-configurable), [07](07-ui.md#payments), [14](14-ai-integration.md)): `{method}`, `{amount}`, `{currency}`, `{merchant}`, `{gateway}`, `{reference}` and `{customer_email}`, each with what it becomes and an example; the Flows sheet gets a Variables reference, an Insert variable menu per label and a filled preview per step; unknown variables are refused on save; `GET /payments/flow-variables`, CLI `sendmock payments flows variables` and MCP `sendmock_payment_flow_variable_list` share the list. Criterion PY-12.7. |
| 2026-10-25 | Step label variables built on mock data (part 4b): the flow sheet lists `{method}`, `{amount}`, `{currency}`, `{merchant}`, `{gateway}`, `{reference}` and `{customer_email}` with what each becomes and an example; every label field has an Insert variable menu that inserts at the caret; each step shows a preview with example values (the method's name when a method uses the flow); an unknown variable is refused on save naming the known ones; the checkout page fills all seven; the mock API serves `GET /payments/flow-variables`. PY-12.7 has tests. |
| 2026-10-25 | Payment gateways built on mock data (part 5a of 5): the five built-in gateways are now data (methods offered, credentials, notification endpoint, redirect method and fields, content type, event names, body and header templates) that reproduce the previous redirect and notification shapes, and every redirect and notification renders from them. Payments > Gateways (new nav child) lists them with methods, endpoint, Built-in / Custom, Modified and an enabled switch; Add gateway starts from a built-in or blank; the edit sheet has General, Checkout (methods in order, Open a test checkout), Merchant (credentials masked, reveal asks first, notification endpoint), Redirect (fields sent always or only on success) and Notification (event names, body in the code editor, header templates) with a live preview against a chosen payment, event and outcome and the template reference beside them; template errors block saving. New template functions `uuid()`, `random_hex()`, `now_iso()` and `stripe_signature()`. Payments show the gateway's name. Mock API: `/payments/gateways` with reset, preview, secret reveal, and `POST /payments/checkout` for any gateway. PY-12.2, PY-12.3 (custom gateways) and PY-12.4 have tests. |
| 2026-10-25 | Plan: Settings > Payments and the Overview payments tile in detail ([17](17-payments.md#ui), [07](07-ui.md)): merchant name, default currency and the automatic outcome profile (interactive, auto_success, auto_decline, random with a success rate) apply to new hosted checkouts; the test value tables of the enabled methods; a Payments tile with count, success rate and revenue per currency. PY-09.4 reworded (reason: merchant credentials moved to each gateway in PY-12.2, so Settings links to Gateways instead of editing them); new criterion PY-09.5 for the tile. |
| 2026-10-25 | Settings > Payments and the Overview payments tile built on mock data (part 5b of 5, the payments item is done): a Payments settings section with the merchant name (checkout pages and `{merchant}`), default currency and automatic outcome profile (interactive, always succeed, always decline, random with a success rate) applied to new hosted checkouts, and the test card and test number tables of the enabled methods with OTP / PIN and links to Gateways and Methods; the Overview gets a Payments tile (count, today, success rate, test revenue per currency). PY-09.4 and PY-09.5 have tests. |
| 2026-10-25 | Plan: Replies UI in detail ([07](07-ui.md)): the reply webhook result line under inbound SMS bubbles, the TwiML reply badge and the drawer's Reply webhook tab; Webhooks > Inbound routes with list, editor in Mailgun syntax and a live match preview with captured groups. New criterion WH-12.7. The Numbers part (inbound URL and fallback) was already built in U1. |
| 2026-10-25 | SMS reply webhook built on mock data (Replies R1): inbound messages go to the Messaging Service or number URL with Twilio's form fields and headers, the fallback URL gets `ErrorCode` and `ErrorUrl` when the primary fails, and failures carry Twilio's codes (11200, 11205, 12100, 12300); the result line under inbound bubbles ("Reply webhook 200, 1 TwiML reply", "Fallback 200 after 11205", "Rules only"); `<Message>` TwiML becomes a reply in the thread with a TwiML reply badge that jumps to the message it answers, `<Redirect>` is followed up to 10 fetches; the drawer's Reply webhook tab shows each attempt's request, response and parsed TwiML with Resend reply webhook (`POST /sms/{smsId}/reply-webhook/resend`). In the demo the fixtures' app at localhost:8000 answers and other hosts refuse the connection, so the WhatsApp service shows its fallback. SM-09.7 has tests. |
| 2026-10-25 | Inbound routes built on mock data (Replies R2, U2 complete): Webhooks > Inbound routes lists Mailgun-style routes by priority with their expression and action chips, reorders them (priority swap) and deletes them; the editor sheet builds the filter (match recipient, match header, catch all) and the actions (forward to URL, forward to email, store and notify, stop) in Mailgun syntax with `(?P<name>...)` groups usable as `\g<name>`, and previews "Matches N of the last 50 incoming emails" with captured groups and regex errors as you type. New incoming emails (replies and forwards as recipient) run the matching routes until `stop()`: forwards post Mailgun's multipart fields and appear in the email timeline and the delivery log, forwarding to an email follows the release allowlist. Mock API: `/api/v1/inbound-routes` with `POST /inbound-routes/test`. WH-12.7 has tests. |
| 2026-10-26 | Plan: Phase U3 in full ([18](18-phase-u3.md)): the sign-off gate, eleven workstreams in order with branches, criteria and dependencies (W1 design review guards, W2 notifications, W3 accessibility, W4 responsive, W5 performance, W6 design review pass, W7 OpenAPI contract freeze, W8 landing page, W9 docs structure, W10 API reference and playground, W11 feedback and sign-off), each with its deliverables and tests. New feature UI-09 Contract freeze (3 criteria): the spec is generated from an endpoint registry and the API types, with drift checks in CI. |
| 2026-10-26 | Plan: page titles and sidebar group chevrons ([18](18-phase-u3.md#w1-and-w6-design-review)): every screen sets its browser tab title `<Screen> · SendMock` (open item first), checked by the states test (new criterion UI-07.4, part of W1); sidebar items with sub-items show a rotating chevron (W6 fix list). |
| 2026-10-26 | Plan: community links and GitHub templates ([18](18-phase-u3.md#w12-community-links-and-github-templates-ui-10), W12): a header Help menu and Settings > About links (docs, shortcuts, changelog, Report an issue and Request a feature as pre-filled GitHub issue forms, private security reporting, Star on GitHub), website header and footer links, issue forms (bug, feature, provider request, docs) with `config.yml`, a PR template, `SECURITY.md`, `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`. New feature UI-10 (2 criteria). |
| 2026-10-26 | Plan: notification settings add the toast position ([18](18-phase-u3.md#w2-notifications-ui-08), [07](07-ui.md#notifications)): Settings > Notifications shows or hides pop-up toasts and picks where they appear (top or bottom, left, center or right) with a preview; the header bell at the top right shows the unread count and opens the notification list. New criterion UI-08.4. |
| 2026-10-26 | Design review guards built (U3 W1): a unit test fails on Tailwind palette colours, `bg-white` / `text-black` and hex colours in class names (UI-07.1; the four found moved to the success and warning tokens); the demo's simulated 500 / 404 now apply to every endpoint through one mock handler; one shared `QueryErrorState` replaces thirteen copies and is added to the ten screens that had none (webhooks overview, inbound routes, composer, gateways, methods, flows, numbers, Messaging Services, both logs, HTTP catcher, which showed its onboarding on errors); every screen sets its tab title (`Gateways · Payments · SendMock`, the open email or number first; UI-07.4); a states test opens every screen with errors (message, navigation still works, recovery), slow responses (skeleton) and the empty data set (UI-07.2). The shared slider now names its focusable thumb (the demo latency and SMS failure rate sliders had no accessible name). |
| 2026-10-26 | Plan: Settings > Payments test values follow each method's flow ([17](17-payments.md#ui)): test cards only for card form flows, OTP and PIN only when the flow has those steps, a row for methods without a deciding step (test account or fixed outcome), and an Offered by column naming the gateways, so custom methods and gateways show correctly. PY-09.4 reworded to match (reason: the table read stored values without the flow, so it showed OTP / PIN for voucher methods and hid account and fixed-outcome methods). |
| 2026-10-26 | Notifications built (U3 W2): Settings > Notifications (this browser only, applied at once) shows or hides pop-up toasts and sets the toast position (six places, with a preview toast); the header bell at the top right shows the unread count (99+) and lists the last 50 notifications newest first (new and incoming email, sent and inbound SMS, failed webhook deliveries), each linking to its email, conversation or delivery; opening marks them read and dismisses the visible toasts, Clear all empties it. The mock now announces failed rule deliveries (`webhook.failed`) and puts `thread_id` on SMS events. The design token check moved into ESLint (a shared pattern module, unit tested), since Vitest's module cache kept the old file list. New `destructive-foreground` token. All U3 work stays on `feat/u3-design-review`. UI-08.1 to UI-08.4 have tests. |
| 2026-10-26 | Accessibility pass done (U3 W3): `@axe-core/playwright` (test only) scans every screen in light and dark and the main sheets, dialogs and popovers with no serious or critical issues; fixes: darker light-theme `muted-foreground`, `success`, `warning` and `destructive` for AA contrast on their tints, the success meter is a meter only when it has a value, the unread dot is an image, the template category tabs control the gallery, the rule preview list is focusable. A Skip to content link is the first tab stop, the page has one main landmark, sheets and dialogs give focus back to what opened them (Radix only does this for its own triggers), and a reduced-motion rule makes animations and transitions finish at once. Keyboard-only tests cover the skip link, visible focus, focus trapping and return, the command palette, an SMS reply, editing a flow step and switching a setting. UI-05.1 to UI-05.4 have tests. |
| 2026-10-26 | Responsive pass done (U3 W4): a test opens every screen at 360, 390, 768, 1024, 1280, 1440 and 2560 wide and fails on any element past the right edge that is not inside an intended horizontal scroller, and on a page-level horizontal scroll; the editing sheets (endpoint, rule, inbound route, flow, gateway, method) are checked tab by tab at 360, and a checkout page stacks the order summary above the payment panel. Fixes: sheets are full width on phones (the shadcn default kept them at three quarters, clipping the endpoint body mode buttons), fieldsets may shrink (their browser default `min-width: min-content` pushed forms past the screen), the flow variables table drops its Example column on phones, gateway credential and redirect rows put the value on its own line, the gateway and HTTP request tab strips scroll sideways without clipping and the gateway tabs stay in place while the form scrolls, the email subject wraps beside its actions, and the sidebar drawer closes after navigating on a phone. UI-01.1 has tests. |
| 2026-10-26 | Performance pass done (U3 W5): the live build the binary embeds now leaves out the mock layer and demo toolbar (3.3 MB to 1.84 MB; the imports sit behind a literal build-time check so the bundler drops them instead of emitting unused chunks), its initial JS is 192 KB gzipped and CodeMirror stays out of it; `bun run test:budget` builds it and fails above 250 KB initial JS or 2 MB `dist`, and runs in CI. With 5,000 emails the mail list keeps only the visible rows in the page and an email opens in about 60 ms (median, budget 200 ms), checked end to end; logs and deliveries load 50 rows at a time. UI-06.1 to UI-06.3 have tests. |
| 2026-10-26 | Design review pass done (U3 W6): every screen reviewed in light and dark at 1440 wide, with the main sheets, drawers, the command palette and a checkout page; the review table in [18](18-phase-u3.md#review-table) is filled in and waits for the owner's sign-off in W11. Fixes: sidebar groups show a chevron that turns when the group opens (the SMS badge moves beside it), Overview and Saved deliveries use the same `max-w-6xl` cap as every other page, the Settings danger buttons are all red, the Keep forever hint no longer points at a hidden field, the payment drawer shows provider id names verbatim (`tran_id`), and the gateway preview pickers no longer overlap. |
| 2026-10-26 | Contract frozen (U3 W7): [docs/api/openapi.yaml](../api/openapi.yaml) (OpenAPI 3.1, 169 operations: the 164 endpoints the UI uses and the `/catch/{binPath}` capture URL for five methods, 244 schemas) is generated from an endpoint registry and the TypeScript API types by `bun run openapi`; a Vitest test fails when a mock handler and the registry disagree, and `bun run test:contract` (in CI) fails when the committed file differs from a fresh build, a `$ref` does not resolve or the document is not valid 3.1. New named types replace inline bodies in the handlers (`HealthStatus`, `NativeSendResult`, `OpenEventRequest`, `EmailReleaseRequest`, `SmsStatusUpdate`, `VerificationForceRequest`, `HttpBinUpdate`). [06](06-api.md#contract) was reviewed against the spec: parameter and filter names aligned, missing rows added, and planned endpoints without a screen listed. Dev dependencies: `ts-json-schema-generator`, `@seriousme/openapi-schema-validator`, `yaml`. UI-09.1 to UI-09.3 have tests. |
| 2026-10-26 | Landing page built (U3 W8): hero, an Animated Beam flow (your app to SendMock, then the UI, webhooks and agents), the marquee, the Terminal quick start, product screenshots in a Safari frame with tabs (captured from the mock app by `bun run screenshots`, light and dark), a Bento Grid with payments and the HTTP catcher added, a Number Ticker (15 provider APIs, 8 languages, 169 REST operations counted from the spec) and a closing call to action. With reduced motion the terminal shows every line, the tickers show their values and the beams are static paths. Lighthouse on the static build: accessibility, best practices and SEO 100, performance 84 to 93 on a loaded laptop (median above 90 in Lighthouse CI); replacing the SVG dot pattern with CSS cut the DOM from 1,610 to 617 nodes. Website Playwright tests and Lighthouse CI now run in the Website workflow. The email detail tabs now wrap inside their bar instead of spilling a row below it. WS-02.1 to WS-02.3 have tests. |
| 2026-10-26 | Docs structure drafted (U3 W9): `docs/wiki/` is the source of the user docs (24 Markdown pages: introduction, getting started, install, connect your app with a page per language, email, SMS, Verify, webhooks, templates, variables, HTTP catcher, payments, CLI, MCP and AI, configuration and seed file, troubleshooting), each saying which phase its backend lands in, with screenshots from the mock app. The website syncs them in at build time. A docs test checks every page is published and crawls for broken links and anchors (part of WS-03.3, which also needs search). |
| 2026-10-26 | API reference and playground built (U3 W10): `/api/` and a page per tag generated from the frozen spec, each operation with Try it in Demo mode, and `/playground/` with all 169 operations, a live event stream and scenario mode. Requests are answered in the browser by the demo's own mock API through a bridge page in a hidden iframe (the workspace-package idea was dropped: the two apps' `@/` aliases collide). Path parameters are filled from demo data; snippets in cURL, PHP, JavaScript, Python, Go, Java, Rust, Ruby and C# follow the form. The capture URL no longer declares a body for GET and DELETE. WS-04.1 and WS-04.3 have tests; WS-04.2 has its snippet tests, and running the snippets against a real instance waits for the backend. |
| 2026-10-26 | Community links done (U3 W12): a Help menu in the header and a Help and feedback card on Settings > About link to the docs, keyboard shortcuts, what's new, Report an issue and Request a feature (GitHub issue forms pre-filled with version, channel, OS and browser only), private security reporting and the repository. `.github/` has issue forms for bugs, features, providers and docs, a `config.yml` with blank issues off, a pull request template, `SECURITY.md`, `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`, validated in CI. The website header shows the GitHub star count and a footer carries the same links. Below laptop width the header search is an icon so the header fits at 768 px. UI-10.1 and UI-10.2 have tests. |
